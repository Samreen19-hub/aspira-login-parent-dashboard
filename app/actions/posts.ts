'use server'

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, ensureFollowsTable, ensurePostHidesTable, ensurePostsTables } from '@/lib/db'
import {
  connections,
  eventRsvps,
  follows,
  pollVotes,
  postComments,
  postHides,
  postLikes,
  posts,
  profiles,
  user,
} from '@/lib/db/schema'

/**
 * DB-backed User Posts, phase one. Every post type (achievement, photo, event,
 * poll, text, and any future kind) is stored in the SINGLE `public.posts` table
 * using the shared Neon database, Better Auth session handling, and the lazy
 * `ensurePostsTables` + server-action conventions already used across the app.
 *
 * Security model, enforced entirely server-side (mirrors `notifications.ts`):
 *   - The author of a created post and the actor of every interaction (like,
 *     comment, vote, rsvp) are ALWAYS the authenticated session user. The
 *     browser can never supply or spoof an author/user id.
 *   - Reads that expose per-user state (liked-by-me, my vote, my rsvp) are
 *     scoped to the authenticated user.
 *
 * This phase intentionally does NOT: create notifications, add realtime, or
 * upload/persist photo blobs. It also does not migrate or delete any existing
 * localStorage data, and does not replace any existing UI/component.
 */

/** Post kinds recognized today. `type` is free-text, so new kinds are allowed. */
export type PostType = 'text' | 'photo' | 'achievement' | 'poll' | 'event'

export type PostAuthor = {
  id: string
  name: string | null
  avatar: string | null
}

export type PostCommentView = {
  id: string
  body: string
  createdAt: string
  author: PostAuthor
}

export type PostView = {
  id: string
  type: string
  authorId: string
  body: string | null
  scope: string | null
  payload: Record<string, unknown>
  createdAt: string
  author: PostAuthor
  likeCount: number
  likedByMe: boolean
  commentCount: number
  comments: PostCommentView[]
  /** Vote tally aligned to the poll's `options[]` (index -> count). */
  pollTally: number[]
  /** The signed-in user's chosen option index, or null if they have not voted. */
  myVote: number | null
  /** The signed-in user's RSVP status for an event post, or null. */
  myRsvp: string | null
  /** Total number of users marked "going" for an event post (all users). */
  rsvpGoingCount: number
  /** Total number of users marked "interested" for an event post (all users). */
  rsvpInterestedCount: number
  /** Users marked "going" (display info), for the event's participant list. */
  rsvpGoing: PostAuthor[]
  /** Users marked "interested" (display info), for the event's participant list. */
  rsvpInterested: PostAuthor[]
  /**
   * True when the signed-in user has hidden this post from their own feed
   * (a viewer-scoped `post_hides` marker exists). The feed never returns hidden
   * posts, so this is only meaningful for reads that intentionally include them
   * (e.g. Saved Posts), where it drives the "hidden from your feed" indicator.
   */
  hiddenByMe: boolean
  /**
   * True when the signed-in user is the post's author. Resolved server-side and
   * used by the UI to decide whether to offer the author-only Delete control.
   * Delete is still enforced author-only in `deletePost` regardless of this.
   */
  isMine: boolean
}

type CreatePostInput = {
  type: PostType | string
  body?: string | null
  /** null/undefined = main Home feed; otherwise the group/community slug. */
  scope?: string | null
  /** Type-specific fields (achievement/photo/poll/event). Stored as JSONB. */
  payload?: Record<string, unknown> | null
}

/** The authenticated user. Throws when signed out (matches notifications.ts). */
async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

/**
 * A blob: URL from `URL.createObjectURL` is only valid in the tab that created
 * it and can never be persisted meaningfully. Until real upload/storage exists,
 * we keep an image value ONLY when it is already a permanent URL and strip
 * anything else so the DB never stores a dead reference.
 */
function isPermanentUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.startsWith('blob:') || value.startsWith('data:')) return false
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/')
  )
}

/**
 * Sanitizes the type-specific payload before it is stored. Currently this only
 * drops a non-permanent photo `image` (blob:/data: URLs) so no unusable image
 * reference is ever written; all other fields pass through unchanged.
 */
function sanitizePayload(
  type: string,
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(payload ?? {}) }
  if (type === 'photo' && 'image' in next && !isPermanentUrl(next.image)) {
    delete next.image
  }
  return next
}

/**
 * Creates a post authored by the signed-in user. The author is taken from the
 * session, NEVER from the client. Supports every post type via the shared
 * table + JSONB payload. Deliberately creates NO notification (creating a post
 * must never notify anyone).
 */
export async function createPost(input: CreatePostInput): Promise<PostView> {
  const authorId = await getUserId()
  if (!input.type) throw new Error('A post type is required.')
  await ensurePostsTables()

  const rows = await db
    .insert(posts)
    .values({
      authorId,
      type: input.type,
      body: input.body ?? null,
      scope: input.scope ?? null,
      payload: sanitizePayload(input.type, input.payload),
    })
    .returning()

  const row = rows[0]
  const author = await resolveAuthors([authorId])

  return {
    id: row.id,
    type: row.type,
    authorId: row.authorId,
    body: row.body,
    scope: row.scope,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.toISOString(),
    author: author.get(authorId) ?? { id: authorId, name: null, avatar: null },
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
    comments: [],
    hiddenByMe: false,
    pollTally: [],
    myVote: null,
    myRsvp: null,
    rsvpGoingCount: 0,
    rsvpInterestedCount: 0,
    rsvpGoing: [],
    rsvpInterested: [],
    isMine: true,
  }
}

/**
 * Loads a feed, newest first. `scope` mirrors the client convention:
 *   - undefined / null  -> the main Home feed (posts with no scope)
 *   - a slug            -> that group/community feed
 * Each post is annotated with aggregate counts and the signed-in user's own
 * like / vote / rsvp state, all resolved server-side.
 */
export async function getFeed(
  scope?: string | null,
): Promise<PostView[]> {
  const meId = await getUserId()
  await ensurePostsTables()
  await ensurePostHidesTable()

  let scopeWhere
  if (scope == null) {
    // HOME FEED visibility, enforced in SQL (never hidden in React): a Home post
    // is returned only when the viewer authored it, has an accepted connection
    // with the author, or follows the author. The author always sees their own.
    await ensureFollowsTable()
    const allowedAuthorIds = await getVisibleHomeAuthorIds(meId)
    scopeWhere = and(
      sql`${posts.scope} IS NULL`,
      inArray(posts.authorId, allowedAuthorIds),
    )
  } else {
    // GROUP / COMMUNITY feeds keep their existing scope-based behavior. The
    // connection/follow rule is intentionally NOT applied here; access is
    // governed by the existing membership gate in the space view.
    scopeWhere = eq(posts.scope, scope)
  }

  // Exclude posts the viewer has hidden (viewer-scoped; never deletes the post).
  const hiddenSubquery = db
    .select({ id: postHides.postId })
    .from(postHides)
    .where(eq(postHides.userId, meId))

  const postRows = await db
    .select()
    .from(posts)
    .where(and(scopeWhere, sql`${posts.id} NOT IN (${hiddenSubquery})`))
    .orderBy(desc(posts.createdAt))

  return annotatePosts(postRows, meId)
}

/**
 * Loads every DB-backed EVENT post the signed-in user may see, across scopes, so
 * the Events page can render server events from all sources through the SAME
 * `public.posts` pipeline the Home feed uses (no separate event store). Included:
 *   - unscoped (Home) events by the viewer, their accepted connections, or people
 *     they follow — identical gating to `getFeed(null)`, enforced in SQL; and
 *   - events scoped to any group/community slug the viewer passes in (their live
 *     joined/following membership). Final per-source visibility is still applied
 *     client-side by `toEventView`, so this only widens the candidate set.
 * Viewer-hidden posts are excluded. Read-only; reuses `annotatePosts` so the
 * shape (counts, my rsvp, participant lists) matches the rest of the feed.
 */
export async function getVisibleEvents(scopes: string[]): Promise<PostView[]> {
  const meId = await getUserId()
  await ensurePostsTables()
  await ensurePostHidesTable()
  await ensureFollowsTable()

  const allowedAuthorIds = await getVisibleHomeAuthorIds(meId)
  const scopeList = Array.from(new Set((scopes ?? []).filter(Boolean)))

  const hiddenSubquery = db
    .select({ id: postHides.postId })
    .from(postHides)
    .where(eq(postHides.userId, meId))

  const homeVisible = and(
    sql`${posts.scope} IS NULL`,
    inArray(posts.authorId, allowedAuthorIds),
  )
  const scopeVisible = scopeList.length
    ? inArray(posts.scope, scopeList)
    : sql`false`

  const postRows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.type, 'event'),
        sql`${posts.id} NOT IN (${hiddenSubquery})`,
        or(homeVisible, scopeVisible),
      ),
    )
    .orderBy(desc(posts.createdAt))

  return annotatePosts(postRows, meId)
}

/**
 * Resolves the set of author ids whose Home (unscoped) posts the viewer may see:
 * the viewer themselves, everyone they have an ACCEPTED connection with (either
 * direction), and everyone they follow. Always includes `meId`, so the returned
 * array is never empty and the author always sees their own posts.
 */
async function getVisibleHomeAuthorIds(meId: string): Promise<string[]> {
  const allowed = new Set<string>([meId])

  const acceptedConnections = await db
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
  for (const conn of acceptedConnections) {
    allowed.add(conn.requesterId === meId ? conn.recipientId : conn.requesterId)
  }

  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, meId))
  for (const row of followingRows) allowed.add(row.id)

  return Array.from(allowed)
}

/**
 * Resolves a specific set of posts by id, newest first, regardless of scope.
 * Used by the Saved Posts view to render DB-backed posts whose UUIDs were saved
 * to the existing (localStorage) saved-id list. Read-only; introduces no new
 * saved-post storage and does not change how posts are saved.
 */
export async function getPostsByIds(ids: string[]): Promise<PostView[]> {
  const meId = await getUserId()
  const unique = Array.from(new Set((ids ?? []).filter(Boolean)))
  if (unique.length === 0) return []
  await ensurePostsTables()

  const postRows = await db
    .select()
    .from(posts)
    .where(inArray(posts.id, unique))
    .orderBy(desc(posts.createdAt))

  return annotatePosts(postRows, meId)
}

/**
 * Annotates raw post rows with aggregate counts and the signed-in user's own
 * like / vote / rsvp state. Shared by `getFeed` and `getPostsByIds` so both
 * return identically-shaped, fully-rendered posts.
 */
async function annotatePosts(
  postRows: (typeof posts.$inferSelect)[],
  meId: string,
): Promise<PostView[]> {
  if (postRows.length === 0) return []

  const postIds = postRows.map((p) => p.id)

  // Aggregate like counts and whether the signed-in user liked each post.
  const likeRows = await db
    .select({ postId: postLikes.postId, userId: postLikes.userId })
    .from(postLikes)
    .where(inArray(postLikes.postId, postIds))

  const likeCounts = new Map<string, number>()
  const likedByMe = new Set<string>()
  for (const like of likeRows) {
    likeCounts.set(like.postId, (likeCounts.get(like.postId) ?? 0) + 1)
    if (like.userId === meId) likedByMe.add(like.postId)
  }

  // Comments, oldest first (natural reading order), with author display info.
  const commentRows = await db
    .select({
      id: postComments.id,
      postId: postComments.postId,
      authorId: postComments.authorId,
      body: postComments.body,
      createdAt: postComments.createdAt,
    })
    .from(postComments)
    .where(inArray(postComments.postId, postIds))
    .orderBy(postComments.createdAt)

  // Poll votes: per-post tally by option index + the signed-in user's vote.
  const voteRows = await db
    .select({
      postId: pollVotes.postId,
      userId: pollVotes.userId,
      optionIndex: pollVotes.optionIndex,
    })
    .from(pollVotes)
    .where(inArray(pollVotes.postId, postIds))

  const pollTally = new Map<string, number[]>()
  const myVote = new Map<string, number>()
  for (const vote of voteRows) {
    const tally = pollTally.get(vote.postId) ?? []
    tally[vote.optionIndex] = (tally[vote.optionIndex] ?? 0) + 1
    pollTally.set(vote.postId, tally)
    if (vote.userId === meId) myVote.set(vote.postId, vote.optionIndex)
  }

  // The signed-in user's RSVP for each event post (scoped to this user only).
  const rsvpRows = await db
    .select({ postId: eventRsvps.postId, status: eventRsvps.status })
    .from(eventRsvps)
    .where(
      and(inArray(eventRsvps.postId, postIds), eq(eventRsvps.userId, meId)),
    )
  const myRsvp = new Map<string, string>()
  for (const rsvp of rsvpRows) myRsvp.set(rsvp.postId, rsvp.status)

  // Every user's RSVP for these posts, for the aggregate "going"/"interested"
  // counts and the participant lists shown on the event card and details dialog.
  // The sentinel "none" status (a cleared RSVP) is intentionally ignored.
  const allRsvpRows = await db
    .select({
      postId: eventRsvps.postId,
      userId: eventRsvps.userId,
      status: eventRsvps.status,
    })
    .from(eventRsvps)
    .where(inArray(eventRsvps.postId, postIds))
  const goingIdsByPost = new Map<string, string[]>()
  const interestedIdsByPost = new Map<string, string[]>()
  for (const rsvp of allRsvpRows) {
    const bucket =
      rsvp.status === 'going'
        ? goingIdsByPost
        : rsvp.status === 'interested'
          ? interestedIdsByPost
          : null
    if (!bucket) continue
    const list = bucket.get(rsvp.postId) ?? []
    list.push(rsvp.userId)
    bucket.set(rsvp.postId, list)
  }

  // Which of these posts the signed-in user has hidden (viewer-scoped). The feed
  // already excludes hidden posts; this only matters for reads that include them
  // (Saved Posts) so the UI can surface the hidden state and an Unhide action.
  const hideRows = await db
    .select({ postId: postHides.postId })
    .from(postHides)
    .where(and(inArray(postHides.postId, postIds), eq(postHides.userId, meId)))
  const hiddenByMe = new Set<string>()
  for (const hide of hideRows) hiddenByMe.add(hide.postId)

  // Resolve author display info for post authors and comment authors together.
  const authorIds = new Set<string>()
  for (const p of postRows) authorIds.add(p.authorId)
  for (const c of commentRows) authorIds.add(c.authorId)
  for (const ids of goingIdsByPost.values()) for (const id of ids) authorIds.add(id)
  for (const ids of interestedIdsByPost.values()) for (const id of ids) authorIds.add(id)
  const authors = await resolveAuthors(Array.from(authorIds))
  const toAuthorList = (ids: string[]) =>
    ids.map((id) => authors.get(id) ?? { id, name: null, avatar: null })

  const commentsByPost = new Map<string, PostCommentView[]>()
  for (const c of commentRows) {
    const list = commentsByPost.get(c.postId) ?? []
    list.push({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: authors.get(c.authorId) ?? {
        id: c.authorId,
        name: null,
        avatar: null,
      },
    })
    commentsByPost.set(c.postId, list)
  }

  const normalizeTally = (tally: number[]) => {
    const filled: number[] = []
    for (let i = 0; i < tally.length; i++) filled[i] = tally[i] ?? 0
    return filled
  }

  return postRows.map((p) => {
    const comments = commentsByPost.get(p.id) ?? []
    return {
      id: p.id,
      type: p.type,
      authorId: p.authorId,
      body: p.body,
      scope: p.scope,
      payload: (p.payload as Record<string, unknown>) ?? {},
      createdAt: p.createdAt.toISOString(),
      author: authors.get(p.authorId) ?? {
        id: p.authorId,
        name: null,
        avatar: null,
      },
      likeCount: likeCounts.get(p.id) ?? 0,
      likedByMe: likedByMe.has(p.id),
      commentCount: comments.length,
      comments,
      pollTally: normalizeTally(pollTally.get(p.id) ?? []),
      myVote: myVote.has(p.id) ? myVote.get(p.id)! : null,
      myRsvp: myRsvp.get(p.id) ?? null,
      rsvpGoingCount: (goingIdsByPost.get(p.id) ?? []).length,
      rsvpInterestedCount: (interestedIdsByPost.get(p.id) ?? []).length,
      rsvpGoing: toAuthorList(goingIdsByPost.get(p.id) ?? []),
      rsvpInterested: toAuthorList(interestedIdsByPost.get(p.id) ?? []),
      hiddenByMe: hiddenByMe.has(p.id),
      isMine: p.authorId === meId,
    }
  })
}

/**
 * Permanently deletes a post AUTHORED BY the signed-in user, along with all of
 * its dependent interaction rows (likes, comments, poll votes, event RSVPs) and
 * any per-user hide markers. Author-only: the delete is scoped to
 * `author_id = meId`, so a user can never delete someone else's post — a request
 * for a post they do not own returns zero rows and throws. This affects only the
 * DB-backed post; seed/localStorage posts are removed by the existing local
 * store and never reach this action.
 */
export async function deletePost(postId: string): Promise<{ deleted: true }> {
  const meId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  await ensurePostsTables()

  // Author-scoped delete: only the owner's row matches, so this both authorizes
  // and performs the delete in one step.
  const deleted = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.authorId, meId)))
    .returning({ id: posts.id })

  if (deleted.length === 0) {
    throw new Error('You can only delete your own post.')
  }

  // Remove dependent interactions so nothing dangles after the post is gone.
  await db.delete(postLikes).where(eq(postLikes.postId, postId))
  await db.delete(postComments).where(eq(postComments.postId, postId))
  await db.delete(pollVotes).where(eq(pollVotes.postId, postId))
  await db.delete(eventRsvps).where(eq(eventRsvps.postId, postId))
  // Clean up any viewer hide markers for the now-deleted post.
  await ensurePostHidesTable()
  await db.delete(postHides).where(eq(postHides.postId, postId))

  return { deleted: true }
}

/**
 * Hides a post from the signed-in user's OWN feed only. This never deletes or
 * modifies the post or any of its interactions — it inserts a viewer-scoped
 * `post_hides` marker, so the post stays fully visible to everyone else.
 * Idempotent via the unique `(post_id, user_id)` index.
 */
export async function hidePost(postId: string): Promise<{ hidden: true }> {
  const userId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  await ensurePostHidesTable()

  await db
    .insert(postHides)
    .values({ postId, userId })
    .onConflictDoNothing()

  return { hidden: true }
}

/**
 * Reverses `hidePost` for the signed-in user: removes only their own hide marker
 * for the post, leaving the post and everyone else's view untouched.
 */
export async function unhidePost(postId: string): Promise<{ hidden: false }> {
  const userId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  await ensurePostHidesTable()

  await db
    .delete(postHides)
    .where(and(eq(postHides.postId, postId), eq(postHides.userId, userId)))

  return { hidden: false }
}

/**
 * Toggles the signed-in user's like on a post. Idempotent thanks to the unique
 * `(post_id, user_id)` index: an existing like is removed, otherwise one is
 * inserted. Returns the new state and the fresh like count. Does NOT create a
 * notification in this phase.
 */
export async function toggleLike(
  postId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const userId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  await ensurePostsTables()

  const existing = await db
    .select({ id: postLikes.id })
    .from(postLikes)
    .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    .limit(1)

  let liked: boolean
  if (existing.length > 0) {
    await db
      .delete(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userId, userId)))
    liked = false
  } else {
    await db.insert(postLikes).values({ postId, userId })
    liked = true
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postLikes)
    .where(eq(postLikes.postId, postId))

  return { liked, likeCount: countRows[0]?.count ?? 0 }
}

/**
 * Adds a comment authored by the signed-in user. The author is taken from the
 * session, NEVER from the client (this replaces the hardcoded "Rashi Kapoor"
 * author used by the current client-only comments). Does NOT create a
 * notification in this phase.
 */
export async function addComment(
  postId: string,
  body: string,
): Promise<PostCommentView> {
  const authorId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  const text = body?.trim()
  if (!text) throw new Error('A comment cannot be empty.')
  await ensurePostsTables()

  const rows = await db
    .insert(postComments)
    .values({ postId, authorId, body: text })
    .returning()

  const row = rows[0]
  const authors = await resolveAuthors([authorId])

  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: authors.get(authorId) ?? { id: authorId, name: null, avatar: null },
  }
}

/**
 * Records or changes the signed-in user's vote on a poll post. One vote per
 * user per poll is enforced by the unique `(post_id, user_id)` index, so this
 * upserts. `optionIndex` aligns to the poll's `options[]` array in the post
 * payload. Returns the updated tally. Does NOT create a notification here.
 */
export async function votePoll(
  postId: string,
  optionIndex: number,
): Promise<{ pollTally: number[]; myVote: number }> {
  const userId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  if (!Number.isInteger(optionIndex) || optionIndex < 0) {
    throw new Error('A valid poll option is required.')
  }
  await ensurePostsTables()

  await db
    .insert(pollVotes)
    .values({ postId, userId, optionIndex })
    .onConflictDoUpdate({
      target: [pollVotes.postId, pollVotes.userId],
      set: { optionIndex },
    })

  const tallyRows = await db
    .select({
      optionIndex: pollVotes.optionIndex,
      count: sql<number>`count(*)::int`,
    })
    .from(pollVotes)
    .where(eq(pollVotes.postId, postId))
    .groupBy(pollVotes.optionIndex)

  const pollTally: number[] = []
  for (const row of tallyRows) pollTally[row.optionIndex] = row.count
  for (let i = 0; i < pollTally.length; i++) pollTally[i] = pollTally[i] ?? 0

  return { pollTally, myVote: optionIndex }
}

/**
 * Sets or updates the signed-in user's RSVP for an event post. One RSVP per
 * user per event is enforced by the unique `(post_id, user_id)` index, so this
 * upserts (also bumping `updated_at`). This is the server-backed successor to
 * the localStorage RSVP; nothing is migrated in this phase. Does NOT create a
 * notification here.
 */
export async function setRsvp(
  postId: string,
  status: string,
): Promise<{ status: string }> {
  const userId = await getUserId()
  if (!postId) throw new Error('A valid post is required.')
  if (!status) throw new Error('A valid RSVP status is required.')
  await ensurePostsTables()

  await db
    .insert(eventRsvps)
    .values({ postId, userId, status })
    .onConflictDoUpdate({
      target: [eventRsvps.postId, eventRsvps.userId],
      set: { status, updatedAt: new Date() },
    })

  return { status }
}

/**
 * Resolves display name + avatar for a set of user ids by joining `profiles`
 * (preferred) and falling back to the Better Auth `user` image, mirroring how
 * `notifications.ts` annotates actors. Read-only; never mutates.
 */
async function resolveAuthors(
  ids: string[],
): Promise<Map<string, PostAuthor>> {
  const map = new Map<string, PostAuthor>()
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return map

  const rows = await db
    .select({
      id: user.id,
      name: profiles.name,
      userName: user.name,
      avatar: profiles.avatar,
      image: user.image,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .where(inArray(user.id, unique))

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      name: row.name ?? row.userName ?? null,
      avatar: row.avatar ?? row.image ?? null,
    })
  }
  return map
}
