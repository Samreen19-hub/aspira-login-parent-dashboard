'use server'

import { and, eq, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, ensureSpaceMembersTable } from '@/lib/db'
import { profiles, spaceMembers, user } from '@/lib/db/schema'

/**
 * DB-backed Groups/Communities membership & following, on the existing Neon
 * database + Better Auth session, using the same lazy-provisioning
 * (`ensureSpaceMembersTable`) and server-action conventions as the rest of the
 * app (see `posts.ts` / `network.ts`).
 *
 * Single source of truth: `public.space_members`. One row = one user belonging
 * to one space (by its static `slug`), with `role` = `member | admin`. This one
 * table backs group membership, community following, AND admin ownership.
 *
 * Security model, enforced ENTIRELY server-side:
 *   - The acting user of every mutation is ALWAYS the authenticated session
 *     user. The browser can never supply or spoof the actor id.
 *   - Admin-only actions (`makeAdmin`, `removeMember`, `deleteSpace`) verify the
 *     caller is an admin of the space before doing anything.
 *   - A sole admin can never leave the space ownerless: they must transfer
 *     ownership to another member first (or delete the space).
 *
 * This module is ONLY for the Groups/Communities social pages. It never touches
 * the group-chat tables (`conversations`, `conversation_members`), the posts
 * feed, `connections`, or `follows`.
 */

export type SpaceRole = 'member' | 'admin'

/** The current user's profile identity, resolved from profiles + Better Auth. */
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

  await db
    .insert(spaceMembers)
    .values({ slug, userId: meId, role })
    .onConflictDoNothing()
}

/** Group membership: the signed-in user joins `slug` as a member. */
export async function joinSpace(slug: string): Promise<void> {
  await addMembership(slug, 'member')
}

/** Community following: the signed-in user follows `slug` as a member. */
export async function followSpace(slug: string): Promise<void> {
  await addMembership(slug, 'member')
}

/**
 * Records the space CREATOR as an admin member of the space they just created.
 * Upserts to `admin` so the creator always owns their new space, preserving the
 * existing auto-join + auto-admin behavior. Called from the create flow.
 */
export async function createSpace(slug: string): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()

  await db
    .insert(spaceMembers)
    .values({ slug, userId: meId, role: 'admin' })
    .onConflictDoUpdate({
      target: [spaceMembers.slug, spaceMembers.userId],
      set: { role: 'admin' },
    })
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
 * Admin-only. Deletes the entire space membership — every `space_members` row
 * for `slug`. The caller must be an admin. This only removes the membership
 * layer; the posts feed is handled separately by the existing post system.
 */
export async function deleteSpace(slug: string): Promise<void> {
  const meId = await getUserId()
  if (!slug) throw new Error('A valid space is required.')
  await ensureSpaceMembersTable()
  await assertAdmin(slug, meId)

  await db.delete(spaceMembers).where(eq(spaceMembers.slug, slug))
}
