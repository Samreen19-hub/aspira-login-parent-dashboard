'use server'

import { and, eq, ne, notInArray, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { connections, profiles, user } from '@/lib/db/schema'
import type { NetworkPerson, RelationshipStatus } from '@/lib/network-data'

/**
 * Real Network connection system backed by Neon + Better Auth.
 *
 * The `public.connections` table is the single source of truth for
 * relationships. Every mutation derives the acting user's identity from the
 * Better Auth session (never from a browser-supplied id) and every row is
 * addressed by the real user UUIDs, so two accounts created through the normal
 * Aspira sign-up flow can connect end-to-end.
 *
 * Relationship model (one row per unordered user pair, enforced by the
 * `connections_unique_pair` index):
 *   - `pending`  — a request sent by `requester_id` awaiting `recipient_id`.
 *   - `accepted` — a mutual connection (treated bidirectionally).
 *   - `rejected` — a declined request kept as a single row so re-requesting
 *                  reuses it instead of creating a duplicate.
 */

const NETWORK_PATHS = ['/parent/network', '/parent/network/requests']

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function revalidateNetwork() {
  for (const path of NETWORK_PATHS) revalidatePath(path)
}

/** Shape returned by the person-projection select (profiles + user fallback). */
type PersonRow = {
  userId: string
  name: string | null
  avatar: string | null
  headline: string | null
  location: string | null
  image: string | null
}

function toPerson(
  row: PersonRow,
  extra: Partial<NetworkPerson> = {},
): NetworkPerson {
  return {
    id: row.userId,
    name: row.name ?? 'Aspira member',
    avatar: row.avatar ?? row.image ?? '',
    headline: row.headline ?? '',
    location: row.location ?? '',
    mutualConnections: 0,
    ...extra,
  }
}

const PERSON_COLUMNS = {
  userId: profiles.userId,
  name: profiles.name,
  avatar: profiles.avatar,
  headline: profiles.headline,
  location: profiles.location,
  image: user.image,
}

/**
 * All real users (with a profile) except the signed-in user, each annotated
 * with the viewer's relationship to them so the Connect button renders the
 * correct state. This is the source of truth for the Discover tab.
 */
export async function getDiscoverPeople(): Promise<NetworkPerson[]> {
  const meId = await getUserId()

  const myConnections = await db
    .select()
    .from(connections)
    .where(
      or(
        eq(connections.requesterId, meId),
        eq(connections.recipientId, meId),
      ),
    )

  const acceptedUserIds = myConnections
    .filter((connection) => connection.status === 'accepted')
    .map((connection) =>
      connection.requesterId === meId
        ? connection.recipientId
        : connection.requesterId,
    )

  const discoverWhere = acceptedUserIds.length
    ? and(ne(profiles.userId, meId), notInArray(profiles.userId, acceptedUserIds))
    : ne(profiles.userId, meId)

  const people = await db
    .select(PERSON_COLUMNS)
    .from(profiles)
    .leftJoin(user, eq(user.id, profiles.userId))
    .where(discoverWhere)

  // Map otherUserId -> relationship info for O(1) lookup while projecting.
  const byOther = new Map<
    string,
    { status: RelationshipStatus; connectionId: string }
  >()
  for (const conn of myConnections) {
    const otherId =
      conn.requesterId === meId ? conn.recipientId : conn.requesterId
    let status: RelationshipStatus
    if (conn.status === 'accepted') {
      status = 'connected'
    } else if (conn.status === 'pending') {
      status = conn.requesterId === meId ? 'pending_outgoing' : 'pending_incoming'
    } else {
      // rejected / unknown -> allow a fresh request
      status = 'none'
    }
    byOther.set(otherId, { status, connectionId: conn.id })
  }

  return people.map((row) => {
    const rel = byOther.get(row.userId)
    return toPerson(row, {
      relationshipStatus: rel?.status ?? 'none',
      connectionId: rel && rel.status !== 'none' ? rel.connectionId : undefined,
    })
  })
}

/**
 * The signed-in user's accepted connections, treated bidirectionally: a row
 * counts whether the user is the requester or the recipient. Returns the *other*
 * person in each pair — never the user themselves.
 */
export async function getConnections(): Promise<NetworkPerson[]> {
  const meId = await getUserId()

  const rows = await db
    .select({
      ...PERSON_COLUMNS,
      connectionId: connections.id,
      connectedAt: connections.updatedAt,
    })
    .from(connections)
    .innerJoin(
      profiles,
      or(
        and(
          eq(connections.requesterId, meId),
          eq(profiles.userId, connections.recipientId),
        ),
        and(
          eq(connections.recipientId, meId),
          eq(profiles.userId, connections.requesterId),
        ),
      ),
    )
    .leftJoin(user, eq(user.id, profiles.userId))
    .where(eq(connections.status, 'accepted'))

  return rows.map((row) =>
    toPerson(row, {
      connectionId: row.connectionId,
      connectedAt: row.connectedAt?.toISOString(),
    }),
  )
}

/**
 * Incoming pending requests for the signed-in user (they are the recipient).
 * Each person carries the `connectionId` needed to accept or decline.
 */
export async function getIncomingRequests(): Promise<NetworkPerson[]> {
  const meId = await getUserId()

  const rows = await db
    .select({
      ...PERSON_COLUMNS,
      connectionId: connections.id,
    })
    .from(connections)
    .innerJoin(profiles, eq(profiles.userId, connections.requesterId))
    .leftJoin(user, eq(user.id, profiles.userId))
    .where(
      and(
        eq(connections.recipientId, meId),
        eq(connections.status, 'pending'),
      ),
    )

  return rows.map((row) => toPerson(row, { connectionId: row.connectionId }))
}

export type SendRequestResult = {
  status: RelationshipStatus
}

/**
 * Send a connection request from the signed-in user to `targetUserId`.
 * Server-side validation prevents self-requests and duplicate rows in either
 * direction; a previously rejected pair is reused (flipped to a fresh pending
 * request from the current sender).
 */
export async function sendConnectionRequest(
  targetUserId: string,
): Promise<SendRequestResult> {
  const meId = await getUserId()

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new Error('A valid person is required.')
  }
  if (targetUserId === meId) {
    throw new Error('You cannot connect with yourself.')
  }

  // Target must be a real user.
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1)
  if (!target) throw new Error('That person could not be found.')

  // Look for any existing relationship in either direction.
  const [existing] = await db
    .select()
    .from(connections)
    .where(
      or(
        and(
          eq(connections.requesterId, meId),
          eq(connections.recipientId, targetUserId),
        ),
        and(
          eq(connections.requesterId, targetUserId),
          eq(connections.recipientId, meId),
        ),
      ),
    )
    .limit(1)

  if (existing) {
    if (existing.status === 'accepted') return { status: 'connected' }
    if (existing.status === 'pending') {
      return {
        status:
          existing.requesterId === meId
            ? 'pending_outgoing'
            : 'pending_incoming',
      }
    }
    // Reuse a rejected row: reset it as a fresh pending request from me.
    await db
      .update(connections)
      .set({
        requesterId: meId,
        recipientId: targetUserId,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(connections.id, existing.id))
    revalidateNetwork()
    return { status: 'pending_outgoing' }
  }

  try {
    await db.insert(connections).values({
      requesterId: meId,
      recipientId: targetUserId,
      status: 'pending',
    })
  } catch {
    // Unique-pair index caught a race: a relationship now exists, so treat the
    // request as already sent rather than surfacing a hard error.
    return { status: 'pending_outgoing' }
  }

  revalidateNetwork()
  return { status: 'pending_outgoing' }
}

/**
 * Accept an incoming request. Only the authenticated recipient of a still
 * pending request can accept it; the row is flipped to `accepted`.
 */
export async function acceptConnectionRequest(
  connectionId: string,
): Promise<void> {
  const meId = await getUserId()
  if (!connectionId) throw new Error('A valid request is required.')

  const updated = await db
    .update(connections)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.recipientId, meId),
        eq(connections.status, 'pending'),
      ),
    )
    .returning({ id: connections.id })

  if (updated.length === 0) {
    throw new Error('This request is no longer available.')
  }

  revalidateNetwork()
}

/**
 * Decline an incoming request. Only the authenticated recipient of a pending
 * request can decline it; the row is marked `rejected` (no new row, no accepted
 * connection).
 */
export async function declineConnectionRequest(
  connectionId: string,
): Promise<void> {
  const meId = await getUserId()
  if (!connectionId) throw new Error('A valid request is required.')

  const updated = await db
    .update(connections)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(
      and(
        eq(connections.id, connectionId),
        eq(connections.recipientId, meId),
        eq(connections.status, 'pending'),
      ),
    )
    .returning({ id: connections.id })

  if (updated.length === 0) {
    throw new Error('This request is no longer available.')
  }

  revalidateNetwork()
}

/**
 * Remove a relationship with `otherUserId`. The authenticated user must be a
 * member of the connection (either direction); the row is deleted so both
 * users' lists and counts update.
 */
export async function removeConnection(otherUserId: string): Promise<void> {
  const meId = await getUserId()
  if (!otherUserId) throw new Error('A valid person is required.')

  await db
    .delete(connections)
    .where(
      or(
        and(
          eq(connections.requesterId, meId),
          eq(connections.recipientId, otherUserId),
        ),
        and(
          eq(connections.requesterId, otherUserId),
          eq(connections.recipientId, meId),
        ),
      ),
    )

  revalidateNetwork()
}
