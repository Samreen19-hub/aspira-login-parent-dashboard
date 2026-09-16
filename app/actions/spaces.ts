'use server'

import { and, eq, ilike, inArray, ne, notInArray, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import {
  db,
  ensureSpaceInvitationsTable,
  ensureSpaceMembersTable,
  ensureSpacesTable,
} from '@/lib/db'
import {
  connections,
  profiles,
  spaceInvitations,
  spaceMembers,
  spaces as spacesTable,
  user,
} from '@/lib/db/schema'
import { SOCIAL_SPACES, type SocialSpace } from '@/lib/parent-data'

/** A member's role within a space. Admins can invite, remove, and delete. */
export type SpaceRole = 'member' | 'admin'

/**
 * GROUP-only access control. Decides who may JOIN a group:
 *   - `anyone`      — any signed-in user can join directly.
 *   - `connections` — only an accepted connection of the group creator/admin.
 *   - `invite`      — no direct joining; a valid invitation is required.
 * Communities always ignore this (they are public and use Follow).
 */
export type JoinPolicy = 'anyone' | 'connections' | 'invite'

/** Coerces any stored/among-input value to a valid JoinPolicy (defaults to `anyone`). */
function normalizeJoinPolicy(value: string | null | undefined): JoinPolicy {
  return value === 'connections' || value === 'invite' ? value : 'anyone'
}

// ---------------------------------------------------------------------------
// Space DEFINITIONS — DB-backed existence & metadata (public.spaces).
//
// `public.spaces` is the source of truth for whether a Group/Community EXISTS
// and its metadata. It replaces the old hardcoded SOCIAL_SPACES + localStorage
// arrangement so a created space survives refresh, logout/login, and other
// devices. Membership/invitations stay in space_members/space_invitations.
// ---------------------------------------------------------------------------

/** Default badge tone for spaces without a built-in preset (matches the old create flow). */
const DEFAULT_SPACE_TONE = 'bg-violet-100 text-violet-700'

/** Built-in presentation presets, keyed by slug, so seeded spaces keep their exact look. */
const BUILT_IN_BY_SLUG = new Map<string, SocialSpace>(
  SOCIAL_SPACES.map((space) => [space.slug, space]),
)

/** DB stores singular `group | community`; the UI uses plural `groups | communities`. */
function kindToDb(kind: 'groups' | 'communities'): 'group' | 'community' {
  return kind === 'groups' ? 'group' : 'community'
}
function kindFromDb(kind: string): 'groups' | 'communities' {
  return kind === 'community' ? 'communities' : 'groups'
}

/** Presentation-only initials from a title (mirrors the client `initialsOf`). */
function initialsOf(value: string): string {
  return (
    value
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'GC'
  )
}

/**
 * Seeds the built-in SOCIAL_SPACES into `public.spaces` exactly once per process,
 * idempotently. `onConflictDoNothing` on the unique `slug` index means an already
 * present space (built-in OR user-created that happens to share a slug) is never
 * duplicated and its existing row is never overwritten, so re-running is safe and
 * preserves any data. Built-in spaces are system-owned (`created_by = null`).
 */
let spacesSeeded: Promise<void> | null = null
function seedBuiltInSpaces(): Promise<void> {
  if (!spacesSeeded) {
    spacesSeeded = (async () => {
      await ensureSpacesTable()
      if (SOCIAL_SPACES.length === 0) return
      await db
        .insert(spacesTable)
        .values(
          SOCIAL_SPACES.map((space) => ({
            slug: space.slug,
            kind: kindToDb(space.kind),
            title: space.title,
            category: space.category,
            description: space.description,
            privacy: space.privacy,
            // Built-ins keep the unrestricted default so anyone can still join
            // them exactly as before this change.
            joinPolicy: space.kind === 'groups' ? normalizeJoinPolicy(space.joinPolicy) : 'anyone',
            createdBy: null,
          })),
        )
        .onConflictDoNothing({ target: spacesTable.slug })
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      spacesSeeded = null
      throw error
    })
  }
  return spacesSeeded
}

/** Projects a `public.spaces` row into the UI's `SocialSpace` shape. */
function toSocialSpace(row: typeof spacesTable.$inferSelect): SocialSpace {
  const builtIn = BUILT_IN_BY_SLUG.get(row.slug)
  const kind = kindFromDb(row.kind)
  return {
    slug: row.slug,
    kind,
    title: row.title,
    description: row.description ?? '',
    category: row.category ?? '',
    // Live counts come from public.space_members via getSpaceCounts, so this
    // static field is unused for display and kept only for the shared shape.
    members: 0,
    // Presentation fields aren't persisted; built-ins keep their preset look and
    // user-created spaces derive the same defaults the old create flow used.
    tone: builtIn?.tone ?? DEFAULT_SPACE_TONE,
    initials: builtIn?.initials ?? initialsOf(row.title),
    // Communities are ALWAYS public regardless of any legacy stored value, so a
    // private/public selector can never apply to them. Groups keep their stored
    // privacy (unused for gating now, but preserved for compatibility).
    privacy: kind === 'communities' ? 'Public' : row.privacy === 'Private' ? 'Private' : 'Public',
    // Group-only access control; communities normalize to `anyone` (unused).
    joinPolicy: kind === 'communities' ? 'anyone' : normalizeJoinPolicy(row.joinPolicy),
    memberNames: builtIn?.memberNames ?? [],
  }
}

/**
 * The set of user ids the signed-in user shares an ACCEPTED connection with
 * (either direction), never including themselves. This is the single source of
 * truth for every "connections only" rule: the group `connections` join policy,
 * the create-time invite picker, and the space invite picker all restrict to
 * exactly these people.
 */
async function acceptedConnectionIds(meId: string): Promise<Set<string>> {
  const rows = await db
    .select({
      requesterId: connections.requesterId,
      recipientId: connections.recipientId,
    })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'accepted'),
        or(
          eq(connections.requesterId, meId),
          eq(connections.recipientId, meId),
        ),
      ),
    )
  const set = new Set<string>()
  for (const row of rows) {
    set.add(row.requesterId === meId ? row.recipientId : row.requesterId)
  }
  set.delete(meId)
  return set
}

/**
 * The GROUP slugs the signed-in user is currently eligible to DISCOVER (and
 * therefore attempt to join). "All" in the Groups UI means exactly this set —
 * NOT every group in the database. Mirrors the server-side join rules in
 * `joinSpace` so a group can never be discovered by someone who could not join
 * it:
 *   - `anyone`      — every authenticated user.
 *   - `connections` — only accepted connections of the group creator or one of
 *                     its admins.
 *   - `invite`      — only users who already have a valid pending invitation.
 * Existing members are ALWAYS eligible for their own groups regardless of
 * policy, so no current member is ever hidden from themselves. Communities are
 * public and never use this. Filtering happens on the slug set (server-side),
 * not by hiding the Join button, so an ineligible group is truly invisible.
 */
async function eligibleGroupSlugs(meId: string): Promise<Set<string>> {
  await ensureSpacesTable()
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()

  const groupRows = await db
    .select({
      slug: spacesTable.slug,
      joinPolicy: spacesTable.joinPolicy,
      createdBy: spacesTable.createdBy,
    })
    .from(spacesTable)
    .where(eq(spacesTable.kind, 'group'))

  const memberRows = await db
    .select({ slug: spaceMembers.slug })
    .from(spaceMembers)
    .where(eq(spaceMembers.userId, meId))
  const memberSet = new Set(memberRows.map((r) => r.slug))

  const inviteRows = await db
    .select({ slug: spaceInvitations.spaceSlug })
    .from(spaceInvitations)
    .where(
      and(
        eq(spaceInvitations.inviteeId, meId),
        eq(spaceInvitations.status, 'pending'),
      ),
    )
  const inviteSet = new Set(inviteRows.map((r) => r.slug))

  const connSet = await acceptedConnectionIds(meId)

  // For `connections` groups, the valid people to be connected to are the
  // creator + current admins (identical to joinSpace's check), so discovery and
  // joinability stay in lock-step. Load those admins in one query.
  const connGroupSlugs = groupRows
    .filter((g) => normalizeJoinPolicy(g.joinPolicy) === 'connections')
    .map((g) => g.slug)
  const adminsBySlug = new Map<string, Set<string>>()
  if (connGroupSlugs.length > 0) {
    const adminRows = await db
      .select({ slug: spaceMembers.slug, userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(
        and(
          inArray(spaceMembers.slug, connGroupSlugs),
          eq(spaceMembers.role, 'admin'),
        ),
      )
    for (const row of adminRows) {
      const set = adminsBySlug.get(row.slug) ?? new Set<string>()
      set.add(row.userId)
      adminsBySlug.set(row.slug, set)
    }
  }

  const eligible = new Set<string>()
  for (const g of groupRows) {
    if (memberSet.has(g.slug)) {
      eligible.add(g.slug)
      continue
    }
    const policy = normalizeJoinPolicy(g.joinPolicy)
    if (policy === 'anyone') {
      eligible.add(g.slug)
      continue
    }
    if (policy === 'connections') {
      const targets = new Set(adminsBySlug.get(g.slug) ?? [])
      if (g.createdBy) targets.add(g.createdBy)
      for (const target of targets) {
        if (connSet.has(target)) {
          eligible.add(g.slug)
          break
        }
      }
      continue
    }
    if (policy === 'invite' && inviteSet.has(g.slug)) {
      eligible.add(g.slug)
    }
  }
  return eligible
}

/**
 * Every space the signed-in user may SEE, read from `public.spaces` (never from
 * a hardcoded array or localStorage). Communities are always public and always
 * included. Groups are filtered to the user's eligible set (see
 * `eligibleGroupSlugs`) so an invite-only or connections-only group is never
 * exposed to someone who could not join it — this is the same list the detail
 * page resolves against, so direct navigation to an ineligible group also fails
 * closed. Seeds the built-in spaces on first call.
 */
export async function listSpaces(): Promise<SocialSpace[]> {
  const meId = await getUserId()
  await seedBuiltInSpaces()
  const rows = await db.select().from(spacesTable)
  const eligible = await eligibleGroupSlugs(meId)
  return rows
    .filter((row) => (row.kind === 'community' ? true : eligible.has(row.slug)))
    .map(toSocialSpace)
}

/** Scope for a paginated listing: everything eligible, or only the user's own. */
export type SpaceScope = 'all' | 'mine'

/** Input for a single page of the Groups/Communities listing. */
export type ListSpacesPageInput = {
  kind: 'groups' | 'communities'
  /** `all` = eligible discovery; `mine` = joined groups / followed communities. */
  scope: SpaceScope
  /** Category chip (`All` or empty means no category filter). */
  category?: string
  /** Free-text search across title/description/category. */
  search?: string
  limit: number
  offset: number
}

/**
 * ONE page of the Groups/Communities listing, resolved and paginated in the DB
 * (limit/offset) so the browser never loads an unbounded number of spaces. The
 * slug universe is decided server-side by scope + eligibility:
 *   - Groups `all`  — the eligible discovery set (`eligibleGroupSlugs`).
 *   - Groups `mine` — groups the user has joined.
 *   - Communities `all`  — every public community (communities are always public).
 *   - Communities `mine` — communities the user follows.
 * Category/search are applied as SQL predicates, and `limit + 1` is fetched to
 * report `hasMore` without a second count query.
 */
export async function listSpacesPage(
  input: ListSpacesPageInput,
): Promise<{ items: SocialSpace[]; hasMore: boolean }> {
  const meId = await getUserId()
  await seedBuiltInSpaces()
  const dbKind = kindToDb(input.kind)
  const limit = Math.max(1, Math.min(input.limit || 12, 60))
  const offset = Math.max(0, input.offset || 0)

  // Decide which slugs are in-scope. `null` means "no slug restriction" (all
  // public communities); otherwise only slugs in the set are eligible.
  let slugUniverse: Set<string> | null = null
  if (input.kind === 'groups') {
    if (input.scope === 'mine') {
      const rows = await db
        .select({ slug: spaceMembers.slug })
        .from(spaceMembers)
        .where(eq(spaceMembers.userId, meId))
      slugUniverse = new Set(rows.map((r) => r.slug))
    } else {
      slugUniverse = await eligibleGroupSlugs(meId)
    }
  } else if (input.scope === 'mine') {
    // Communities `mine` == the communities the user follows.
    const rows = await db
      .select({ slug: spaceMembers.slug })
      .from(spaceMembers)
      .where(eq(spaceMembers.userId, meId))
    slugUniverse = new Set(rows.map((r) => r.slug))
  }

  if (slugUniverse && slugUniverse.size === 0) {
    return { items: [], hasMore: false }
  }

  const conditions = [eq(spacesTable.kind, dbKind)]
  if (slugUniverse) conditions.push(inArray(spacesTable.slug, [...slugUniverse]))
  const category = input.category?.trim()
  if (category && category !== 'All') {
    conditions.push(eq(spacesTable.category, category))
  }
  const search = input.search?.trim()
  if (search) {
    const like = `%${search}%`
    conditions.push(
      or(
        ilike(spacesTable.title, like),
        ilike(spacesTable.description, like),
        ilike(spacesTable.category, like),
      )!,
    )
  }

  const rows = await db
    .select()
    .from(spacesTable)
    .where(and(...conditions))
    .orderBy(spacesTable.title)
    .limit(limit + 1)
    .offset(offset)

  const hasMore = rows.length > limit
  const items = (hasMore ? rows.slice(0, limit) : rows).map(toSocialSpace)
  return { items, hasMore }
}

/** The definitional fields required to create a space; presentation is derived. */
export type CreateSpaceInput = {
  slug: string
  kind: 'groups' | 'communities'
  title: string
  description: string
  category: string
  /**
   * GROUP access control (who can join). Ignored for communities, which are
   * always public. Optional so a community create call may omit it.
   */
  joinPolicy?: JoinPolicy
}

/**
 * The current user's profile identity, resolved from profiles + Better Auth. */
export type Me = {
  id: string
  name: string
  slug: string | null
  avatar: string | null
  headline: string | null
}

/** A single membership row projected with the member's display identity. */
export type SpaceMember = {
  userId: string
  name: string
  slug: string | null
  avatar: string | null
  headline: string | null
  role: SpaceRole
  joinedAt: string
}

/** The signed-in user's live state for one space, plus the space's counts. */
export type SpaceState = {
  slug: string
  memberCount: number
  adminCount: number
  isMember: boolean
  isAdmin: boolean
  myUserId: string
}

/** The authenticated user. Throws when signed out (mirrors the other actions). */
async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

/** Verifies the signed-in user is an admin of `slug`; throws otherwise. */
async function assertAdmin(slug: string, meId: string): Promise<void> {
  const [mine] = await db
    .select({ role: spaceMembers.role })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, meId)))
    .limit(1)
  if (!mine || mine.role !== 'admin') {
    throw new Error('Only an admin can manage this space.')
  }
}

/**
 * The signed-in user's profile identity. Prefers `public.profiles`, falling
 * back to the Better Auth `user` name/image — the same resolution the posts and
 * network actions use. Replaces the old hardcoded `CURRENT_PARENT` constant.
 */
export async function getMe(): Promise<Me> {
  const meId = await getUserId()
  const [row] = await db
    .select({
      userName: user.name,
      image: user.image,
      name: profiles.name,
      slug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(eq(user.id, meId))
    .limit(1)

  return {
    id: meId,
    name: row?.name ?? row?.userName ?? 'Aspira member',
    slug: row?.slug ?? null,
    avatar: row?.avatar ?? row?.image ?? null,
    headline: row?.headline ?? null,
  }
}

/**
 * Every space the signed-in user belongs to, with their role. Drives the
 * listing pages' joined/following state and the admin badge, all from the DB.
 */
export async function getMyMemberships(): Promise<
  { slug: string; role: SpaceRole }[]
> {
  const meId = await getUserId()
  await ensureSpaceMembersTable()

  const rows = await db
    .select({ slug: spaceMembers.slug, role: spaceMembers.role })
    .from(spaceMembers)
    .where(eq(spaceMembers.userId, meId))

  return rows.map((r) => ({
    slug: r.slug,
    role: r.role === 'admin' ? 'admin' : 'member',
  }))
}

/**
 * Member/follower counts for every space, keyed by slug. Used by the listing
 * cards so the count shown always comes from `public.space_members` rather than
 * a static number. Spaces with no real members are simply absent (count 0).
 */
export async function getSpaceCounts(): Promise<Record<string, number>> {
  await getUserId()
  await ensureSpaceMembersTable()

  const rows = await db
    .select({ slug: spaceMembers.slug, count: sql<number>`count(*)::int` })
    .from(spaceMembers)
    .groupBy(spaceMembers.slug)

  const out: Record<string, number> = {}
  for (const row of rows) out[row.slug] = row.count
  return out
}

/**
 * The signed-in user's live state for a single space plus the space's counts.
 * Safe for any viewer (member or not) — it exposes only aggregate counts and
 * the caller's own membership/admin flags, never the roster.
 */
export async function getSpace(slug: string): Promise<SpaceState> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()

  const rows = await db
    .select({ userId: spaceMembers.userId, role: spaceMembers.role })
    .from(spaceMembers)
    .where(eq(spaceMembers.slug, slug))

  let isMember = false
  let isAdmin = false
  let adminCount = 0
  for (const row of rows) {
    if (row.role === 'admin') adminCount += 1
    if (row.userId === meId) {
      isMember = true
      if (row.role === 'admin') isAdmin = true
    }
  }

  return {
    slug,
    memberCount: rows.length,
    adminCount,
    isMember,
    isAdmin,
    myUserId: meId,
  }
}

/**
 * The real roster for a space: every `space_members` row joined to the member's
 * profile/Better Auth identity, oldest first. No fake/sample members are ever
 * invented — this returns exactly who is in the DB. Avatars fall back to the
 * Better Auth image (and the UI falls back to initials when both are null).
 */
export async function getSpaceMembers(slug: string): Promise<SpaceMember[]> {
  await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()

  const rows = await db
    .select({
      userId: spaceMembers.userId,
      role: spaceMembers.role,
      createdAt: spaceMembers.createdAt,
      profileName: profiles.name,
      profileSlug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
      userName: user.name,
      image: user.image,
    })
    .from(spaceMembers)
    .leftJoin(profiles, eq(profiles.userId, spaceMembers.userId))
    .leftJoin(user, eq(user.id, spaceMembers.userId))
    .where(eq(spaceMembers.slug, slug))
    .orderBy(spaceMembers.createdAt)

  return rows.map((r) => ({
    userId: r.userId,
    name: r.profileName ?? r.userName ?? 'Aspira member',
    slug: r.profileSlug ?? null,
    avatar: r.avatar ?? r.image ?? null,
    headline: r.headline ?? null,
    role: r.role === 'admin' ? 'admin' : 'member',
    joinedAt: r.createdAt.toISOString(),
  }))
}

/**
 * Adds the signed-in user to `slug` with the given role. Idempotent via the
 * unique `(slug, user_id)` index, so a repeat join/follow is a no-op.
 */
async function addMembership(slug: string, role: SpaceRole): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()

  await db
    .insert(spaceMembers)
    .values({ slug, userId: meId, role })
    .onConflictDoNothing()

  // The user is now a real member because they joined/followed independently, so
  // any still-`pending` invitation for them to this space must stop being
  // pending. It is marked `cancelled` (NOT `accepted`) because they never
  // accepted it — membership arose on its own. History is preserved and the
  // member count (which reads only `space_members`) is unaffected.
  await db
    .update(spaceInvitations)
    .set({ status: 'cancelled', respondedAt: new Date() })
    .where(
      and(
        eq(spaceInvitations.spaceSlug, slug),
        eq(spaceInvitations.inviteeId, meId),
        eq(spaceInvitations.status, 'pending'),
      ),
    )
}

/**
 * True when `meId` and any user in `targetIds` share an ACCEPTED connection
 * (in either direction). Used to enforce a group's `connections` join policy.
 */
async function hasAcceptedConnectionWithAny(meId: string, targetIds: string[]): Promise<boolean> {
  const others = targetIds.filter((id) => id && id !== meId)
  if (others.length === 0) return false
  const rows = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'accepted'),
        or(
          and(eq(connections.requesterId, meId), inArray(connections.recipientId, others)),
          and(eq(connections.recipientId, meId), inArray(connections.requesterId, others)),
        ),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * Group membership: the signed-in user joins `slug` as a member, subject to the
 * group's `join_policy`:
 *   - `anyone`      — always allowed.
 *   - `connections` — allowed only for an accepted connection of the group
 *                     creator or one of its admins.
 *   - `invite`      — allowed only when a valid (pending) invitation exists for
 *                     this user; there is no other way in.
 * Enforcement lives here (server-side) so direct navigation, the listing card,
 * and the detail page all obey the same rule. Communities skip all of this —
 * they are always public and use Follow. Already-members re-join as a no-op.
 */
export async function joinSpace(slug: string): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpacesTable()
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()

  const [space] = await db
    .select({ kind: spacesTable.kind, createdBy: spacesTable.createdBy, joinPolicy: spacesTable.joinPolicy })
    .from(spacesTable)
    .where(eq(spacesTable.slug, slug))
    .limit(1)

  const policy = normalizeJoinPolicy(space?.joinPolicy)
  // Access control applies only to groups with a restrictive policy. Communities
  // (Follow) and `anyone` groups fall straight through to addMembership.
  if (space && space.kind === 'group' && policy !== 'anyone') {
    const existing = await db
      .select({ userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, meId)))
      .limit(1)
    // Idempotent for someone who is somehow already a member — never lock out an
    // existing member on a repeat action.
    if (existing.length === 0) {
      if (policy === 'connections') {
        // Owner + current admins are the people a joiner must be connected to.
        const adminRows = await db
          .select({ userId: spaceMembers.userId })
          .from(spaceMembers)
          .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.role, 'admin')))
        const targets = new Set(adminRows.map((row) => row.userId))
        if (space.createdBy) targets.add(space.createdBy)
        const allowed = await hasAcceptedConnectionWithAny(meId, [...targets])
        if (!allowed) {
          throw new Error('This group is limited to connections of the group creator. Connect with them first to join.')
        }
      } else if (policy === 'invite') {
        const invite = await db
          .select({ id: spaceInvitations.id })
          .from(spaceInvitations)
          .where(
            and(
              eq(spaceInvitations.spaceSlug, slug),
              eq(spaceInvitations.inviteeId, meId),
              eq(spaceInvitations.status, 'pending'),
            ),
          )
          .limit(1)
        if (invite.length === 0) {
          throw new Error('This group is invite only. Ask a group admin for an invitation to join.')
        }
      }
    }
  }

  await addMembership(slug, 'member')
}

/** Community following: the signed-in user follows `slug` as a member. */
export async function followSpace(slug: string): Promise<void> {
  await addMembership(slug, 'member')
}

/**
 * Creates a Group/Community: persists the space DEFINITION to `public.spaces`
 * AND records the CREATOR as an admin member (auto-join + auto-admin), so the
 * space survives refresh, logout/login, and other devices. `created_by` is
 * ALWAYS the authenticated session user — the browser can never supply or spoof
 * the creator id. The space insert is idempotent on the unique `slug` (a repeat
 * create never duplicates or overwrites), and the membership upsert keeps the
 * creator as `admin`, preserving the existing behavior.
 */
export async function createSpace(input: CreateSpaceInput): Promise<string> {
  const meId = await getUserId()
  const base = input.slug?.trim()
  const title = input.title?.trim()
  if (!base || !title) throw new Error('A valid space is required.')
  await ensureSpacesTable()
  await ensureSpaceMembersTable()

  const joinPolicy =
    input.kind === 'groups' ? normalizeJoinPolicy(input.joinPolicy) : 'anyone'

  // Guarantee a unique slug server-side: `onConflictDoNothing` returns no row
  // when the slug is already taken (possibly by a space this user can't even
  // see), so we retry with a short random suffix until the insert succeeds.
  // The creator is only recorded as admin for the slug we actually created, so
  // we can never attach to someone else's existing space.
  let finalSlug = base
  let created = false
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const inserted = await db
      .insert(spacesTable)
      .values({
        slug: finalSlug,
        kind: kindToDb(input.kind),
        title,
        category: input.category,
        description: input.description,
        // Communities are always public; groups no longer expose a public/private
        // selector, so every new space stores privacy 'Public'. Group access is
        // governed entirely by join_policy.
        privacy: 'Public',
        joinPolicy,
        createdBy: meId,
      })
      .onConflictDoNothing({ target: spacesTable.slug })
      .returning({ slug: spacesTable.slug })
    if (inserted.length > 0) {
      created = true
      break
    }
    finalSlug = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  if (!created) {
    throw new Error('Could not create the space. Please try a different name.')
  }

  await db
    .insert(spaceMembers)
    .values({ slug: finalSlug, userId: meId, role: 'admin' })
    .onConflictDoUpdate({
      target: [spaceMembers.slug, spaceMembers.userId],
      set: { role: 'admin' },
    })

  return finalSlug
}

/**
 * The signed-in user leaves `slug`. A sole admin may never leave the space
 * ownerless: when they are the only admin AND other members remain, they must
 * pass `transferToUserId` — that member is promoted to admin first, then the
 * caller's row is removed. (When nobody else remains the space is theirs to
 * delete instead; the UI offers deletion in that case.)
 */
export async function leaveSpace(
  slug: string,
  transferToUserId?: string,
): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()

  const rows = await db
    .select({ userId: spaceMembers.userId, role: spaceMembers.role })
    .from(spaceMembers)
    .where(eq(spaceMembers.slug, slug))

  const mine = rows.find((r) => r.userId === meId)
  if (!mine) return // Not a member — nothing to leave.

  const adminCount = rows.filter((r) => r.role === 'admin').length
  const others = rows.filter((r) => r.userId !== meId)
  const iAmSoleAdmin = mine.role === 'admin' && adminCount === 1

  if (iAmSoleAdmin && others.length > 0) {
    if (!transferToUserId) {
      throw new Error('Transfer ownership to another member before leaving.')
    }
    const target = others.find((r) => r.userId === transferToUserId)
    if (!target) {
      throw new Error('Choose a valid member to take over as admin.')
    }
    await db
      .update(spaceMembers)
      .set({ role: 'admin' })
      .where(
        and(
          eq(spaceMembers.slug, slug),
          eq(spaceMembers.userId, transferToUserId),
        ),
      )
  }

  await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, meId)))
}

/** Community unfollow: identical to leaving, on the same table. */
export async function unfollowSpace(slug: string): Promise<void> {
  await leaveSpace(slug)
}

/**
 * Admin-only. Promotes another member of `slug` to admin. Existing admins are
 * kept, so a space can have any number of admins. Requires the caller to be an
 * admin and the target to already be a member.
 */
export async function makeAdmin(slug: string, userId: string): Promise<void> {
  const meId = await getUserId()
  if (!slug || !userId) throw new Error('A valid member is required.')
  await ensureSpaceMembersTable()
  await assertAdmin(slug, meId)

  const updated = await db
    .update(spaceMembers)
    .set({ role: 'admin' })
    .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, userId)))
    .returning({ id: spaceMembers.id })

  if (updated.length === 0) {
    throw new Error('That member is not part of this space.')
  }
}

/**
 * Admin-only. Removes another member/follower from `slug`. The caller must be
 * an admin and cannot remove themselves this way (self-exit uses `leaveSpace`).
 */
export async function removeMember(slug: string, userId: string): Promise<void> {
  const meId = await getUserId()
  if (!slug || !userId) throw new Error('A valid member is required.')
  await ensureSpaceMembersTable()
  await assertAdmin(slug, meId)
  if (userId === meId) {
    throw new Error('Use leave/unfollow to remove yourself.')
  }

  await db
    .delete(spaceMembers)
    .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, userId)))
}

/**
 * Admin-only. Deletes the space: its definition row in `public.spaces` AND every
 * `space_members` row for `slug`, so it disappears from the listing and can no
 * longer be resolved. The caller must be an admin (built-in system-owned spaces
 * have no admin and therefore cannot be deleted this way). The posts feed is
 * handled separately by the existing post system and is intentionally untouched.
 */
export async function deleteSpace(slug: string): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpacesTable()
  await ensureSpaceMembersTable()
  await assertAdmin(slug, meId)

  await db.delete(spaceMembers).where(eq(spaceMembers.slug, slug))
  await db.delete(spacesTable).where(eq(spacesTable.slug, slug))
}

// ---------------------------------------------------------------------------
// Invite Members — REAL persisted invitations (public.space_invitations).
//
// An invitation is NOT membership. Sending one only records a `pending` row;
// the invitee becomes a `space_members` member ONLY when they accept. All of
// the security below is enforced entirely server-side against the authenticated
// Better Auth session — the browser can never supply or spoof the actor id, the
// inviter id, or bypass the membership/permission checks.
// ---------------------------------------------------------------------------

/** A real user who can still be invited to a space (dialog data source). */
export type InviteableUser = {
  userId: string
  name: string
  slug: string | null
  avatar: string | null
  headline: string | null
}

/** A real pending invitation for a space, projected with the invitee identity. */
export type PendingInvitation = {
  invitationId: string
  userId: string
  name: string
  slug: string | null
  avatar: string | null
  headline: string | null
  createdAt: string
}

/**
 * Verifies the signed-in user may invite into `slug`: they must already belong
 * to the space (member/follower/admin), mirroring the existing product rule
 * where the Invite action is offered only to members with full access. This is
 * the server-side guarantee — never rely on the UI hiding the button.
 */
async function assertCanInvite(slug: string, meId: string): Promise<void> {
  const [mine] = await db
    .select({ id: spaceMembers.id })
    .from(spaceMembers)
    .where(and(eq(spaceMembers.slug, slug), eq(spaceMembers.userId, meId)))
    .limit(1)
  if (!mine) {
    throw new Error('Join this space before inviting others to it.')
  }
}

/**
 * Real users who can be invited to `slug`, sourced from `neon_auth.user` joined
 * to `public.profiles` — never from a static/dummy contact list. Excludes the
 * signed-in user, everyone already in `public.space_members`, and everyone who
 * already has an active (`pending`) invitation to this space. Avatars fall back
 * to the Better Auth image; the UI falls back to initials when both are null.
 */
export async function getInviteableSpaceUsers(
  slug: string,
): Promise<InviteableUser[]> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()
  await assertCanInvite(slug, meId)

  const memberRows = await db
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(eq(spaceMembers.slug, slug))

  const pendingRows = await db
    .select({ inviteeId: spaceInvitations.inviteeId })
    .from(spaceInvitations)
    .where(
      and(
        eq(spaceInvitations.spaceSlug, slug),
        eq(spaceInvitations.status, 'pending'),
      ),
    )

  // Everyone already in the space or already invited is off the list, plus the
  // signed-in user themselves.
  const excluded = new Set<string>([meId])
  for (const row of memberRows) excluded.add(row.userId)
  for (const row of pendingRows) excluded.add(row.inviteeId)

  const rows = await db
    .select({
      userId: user.id,
      userName: user.name,
      profileName: profiles.name,
      profileSlug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
      image: user.image,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(ne(user.id, meId))
    .orderBy(user.name)

  return rows
    .filter((r) => !excluded.has(r.userId))
    .map((r) => ({
      userId: r.userId,
      name: r.profileName ?? r.userName ?? 'Aspira member',
      slug: r.profileSlug ?? null,
      avatar: r.avatar ?? r.image ?? null,
      headline: r.headline ?? null,
    }))
}

/**
 * Real users who can be invited while CREATING a new space — before the space
 * exists in `public.space_members`, so there is no membership to check yet.
 * Sourced from `neon_auth.user` joined to `public.profiles` (never a static or
 * dummy contact list) and excludes only the signed-in creator. Powers the invite
 * picker in the Create Group/Community dialog. Avatars fall back to the Better
 * Auth image; the UI falls back to initials when both are null.
 */
export async function getInviteableUsers(): Promise<InviteableUser[]> {
  const meId = await getUserId()

  const rows = await db
    .select({
      userId: user.id,
      userName: user.name,
      profileName: profiles.name,
      profileSlug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
      image: user.image,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(ne(user.id, meId))
    .orderBy(user.name)

  return rows.map((r) => ({
    userId: r.userId,
    name: r.profileName ?? r.userName ?? 'Aspira member',
    slug: r.profileSlug ?? null,
    avatar: r.avatar ?? r.image ?? null,
    headline: r.headline ?? null,
  }))
}

/**
 * Real users the signed-in user may invite while creating an INVITE-ONLY group:
 * EXACTLY their accepted connections (see `acceptedConnectionIds`), never the
 * full user directory. This keeps an invite-only group's seed invitations in
 * lock-step with its join rule — only people the creator is actually connected
 * to can be invited — so the group can never be pre-populated with strangers.
 * Communities use `getInviteableUsers` instead (their invitations are an
 * optional sharing feature and never gate access).
 */
export async function getConnectionInviteableUsers(): Promise<InviteableUser[]> {
  const meId = await getUserId()
  const connectionIds = await acceptedConnectionIds(meId)
  if (connectionIds.size === 0) return []

  const rows = await db
    .select({
      userId: user.id,
      userName: user.name,
      profileName: profiles.name,
      profileSlug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
      image: user.image,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, [...connectionIds]))
    .orderBy(user.name)

  return rows.map((r) => ({
    userId: r.userId,
    name: r.profileName ?? r.userName ?? 'Aspira member',
    slug: r.profileSlug ?? null,
    avatar: r.avatar ?? r.image ?? null,
    headline: r.headline ?? null,
  }))
}

/**
 * The active (`pending`) invitations for `slug`, projected with the invitee's
 * identity, newest first. Restricted to members (via `assertCanInvite`) — the
 * same audience that sees the roster. Drives the "Invited" state/badges,
 * replacing the old dummy `INVITE_CONTACTS`-based local state.
 */
export async function getPendingSpaceInvitations(
  slug: string,
): Promise<PendingInvitation[]> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()
  await assertCanInvite(slug, meId)

  // Anyone who is already a real member of this space must NEVER appear as
  // "invited" — membership always wins over a lingering pending row. We exclude
  // them in the query (and `addMembership` also cancels their invite on join),
  // so the invited list and the membership roster can never overlap.
  const memberRows = await db
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(eq(spaceMembers.slug, slug))
  const memberIds = memberRows.map((r) => r.userId)

  const rows = await db
    .select({
      invitationId: spaceInvitations.id,
      userId: spaceInvitations.inviteeId,
      createdAt: spaceInvitations.createdAt,
      profileName: profiles.name,
      profileSlug: profiles.slug,
      avatar: profiles.avatar,
      headline: profiles.headline,
      userName: user.name,
      image: user.image,
    })
    .from(spaceInvitations)
    .leftJoin(user, eq(user.id, spaceInvitations.inviteeId))
    .leftJoin(profiles, eq(profiles.userId, spaceInvitations.inviteeId))
    .where(
      and(
        eq(spaceInvitations.spaceSlug, slug),
        eq(spaceInvitations.status, 'pending'),
        memberIds.length > 0
          ? notInArray(spaceInvitations.inviteeId, memberIds)
          : undefined,
      ),
    )
    .orderBy(spaceInvitations.createdAt)

  return rows.map((r) => ({
    invitationId: r.invitationId,
    userId: r.userId,
    name: r.profileName ?? r.userName ?? 'Aspira member',
    slug: r.profileSlug ?? null,
    avatar: r.avatar ?? r.image ?? null,
    headline: r.headline ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Sends real invitations from the signed-in user to `userIds` for `slug`,
 * creating one `pending` row per invitee in `public.space_invitations`. Returns
 * the number of invitations actually created.
 *
 * Server-side integrity, none of which the browser can bypass:
 *   - the inviter is ALWAYS the session user (`assertCanInvite` also proves they
 *     belong to the space);
 *   - you can never invite yourself;
 *   - only ids that are REAL users (`neon_auth.user`) are accepted;
 *   - anyone already a member is skipped (membership already exists);
 *   - the partial unique index makes a duplicate `pending` invitation impossible
 *     even under a race — `onConflictDoNothing` absorbs it — so a re-invite of an
 *     already-invited user is a silent no-op rather than a duplicate row.
 * No `space_members` row is ever created here: sending is not joining.
 */
export async function inviteToSpace(
  slug: string,
  userIds: string[],
): Promise<{ invited: number }> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  const requested = Array.from(new Set((userIds ?? []).filter(Boolean)))
  if (requested.length === 0) return { invited: 0 }

  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()
  await assertCanInvite(slug, meId)

  // Keep only ids that are REAL users and are not the inviter themselves.
  const realUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, requested), ne(user.id, meId)))
  const realIds = new Set(realUsers.map((r) => r.id))

  // Drop anyone who is already a member — they don't need an invitation.
  const existingMembers = await db
    .select({ userId: spaceMembers.userId })
    .from(spaceMembers)
    .where(
      and(eq(spaceMembers.slug, slug), inArray(spaceMembers.userId, requested)),
    )
  for (const row of existingMembers) realIds.delete(row.userId)

  const toInvite = [...realIds]
  if (toInvite.length === 0) return { invited: 0 }

  const inserted = await db
    .insert(spaceInvitations)
    .values(
      toInvite.map((inviteeId) => ({
        spaceSlug: slug,
        inviterId: meId,
        inviteeId,
        status: 'pending',
      })),
    )
    // The partial unique index only covers `pending`, so a concurrent duplicate
    // pending invite is safely ignored rather than erroring.
    .onConflictDoNothing()
    .returning({ id: spaceInvitations.id })

  return { invited: inserted.length }
}

/**
 * Loads an invitation and verifies the signed-in user is its `invitee`, that it
 * is still `pending`, and returns it. Shared guard for accept/decline so neither
 * can act on someone else's invitation or on an already-resolved one.
 */
async function loadOwnedPendingInvitation(invitationId: string, meId: string) {
  const [row] = await db
    .select({
      id: spaceInvitations.id,
      spaceSlug: spaceInvitations.spaceSlug,
      inviteeId: spaceInvitations.inviteeId,
      inviterId: spaceInvitations.inviterId,
      status: spaceInvitations.status,
    })
    .from(spaceInvitations)
    .where(eq(spaceInvitations.id, invitationId))
    .limit(1)

  if (!row) throw new Error('That invitation no longer exists.')
  if (row.inviteeId !== meId) {
    throw new Error('This invitation was not addressed to you.')
  }
  if (row.status !== 'pending') {
    throw new Error('This invitation has already been responded to.')
  }
  return row
}

/**
 * Accepts an invitation. Only the invitation's own `invitee` may accept, and
 * only while it is still `pending`. On success the user is added to
 * `public.space_members` as a `member` (idempotent via the unique index) and the
 * invitation is marked `accepted` with `responded_at = now()`. Membership is
 * created HERE — never merely by an invitation having been sent.
 */
export async function acceptSpaceInvitation(
  invitationId: string,
): Promise<void> {
  const meId = await getUserId()
  if (!invitationId) throw new Error('A valid invitation is required.')
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()

  const invitation = await loadOwnedPendingInvitation(invitationId, meId)

  await db
    .insert(spaceMembers)
    .values({ slug: invitation.spaceSlug, userId: meId, role: 'member' })
    .onConflictDoNothing()

  await db
    .update(spaceInvitations)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId))
}

/**
 * Declines an invitation. Only the invitation's own `invitee` may decline, and
 * only while it is still `pending`. NO `space_members` row is created — the
 * invitation is simply marked `declined` with `responded_at = now()`.
 */
export async function declineSpaceInvitation(
  invitationId: string,
): Promise<void> {
  const meId = await getUserId()
  if (!invitationId) throw new Error('A valid invitation is required.')
  await ensureSpaceInvitationsTable()

  await loadOwnedPendingInvitation(invitationId, meId)

  await db
    .update(spaceInvitations)
    .set({ status: 'declined', respondedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId))
}

/**
 * Cancels a still-`pending` invitation the signed-in user SENT (or that an admin
 * of the space manages). Marks it `cancelled` with `responded_at = now()` so it
 * frees the partial-unique slot and the invitee can be invited again later. No
 * membership is affected.
 */
export async function cancelSpaceInvitation(
  invitationId: string,
): Promise<void> {
  const meId = await getUserId()
  if (!invitationId) throw new Error('A valid invitation is required.')
  await ensureSpaceMembersTable()
  await ensureSpaceInvitationsTable()

  const [row] = await db
    .select({
      id: spaceInvitations.id,
      spaceSlug: spaceInvitations.spaceSlug,
      inviterId: spaceInvitations.inviterId,
      status: spaceInvitations.status,
    })
    .from(spaceInvitations)
    .where(eq(spaceInvitations.id, invitationId))
    .limit(1)

  if (!row) throw new Error('That invitation no longer exists.')
  if (row.status !== 'pending') {
    throw new Error('This invitation has already been responded to.')
  }

  // The inviter may cancel their own invitation; otherwise the caller must be an
  // admin of the space. Either path is verified server-side.
  if (row.inviterId !== meId) {
    await assertAdmin(row.spaceSlug, meId)
  }

  await db
    .update(spaceInvitations)
    .set({ status: 'cancelled', respondedAt: new Date() })
    .where(eq(spaceInvitations.id, invitationId))
}
