'use server'

import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db, ensureMessagesTable } from '@/lib/db'
import { connections, messages, profiles, user } from '@/lib/db/schema'

/**
 * Real direct-messaging data layer backed by Neon + Better Auth.
 *
 * A conversation is the unordered pair of two users; the `public.messages`
 * table is the single source of truth. Every function derives the acting user
 * from the Better Auth session (never a browser-supplied id) and only messaging
 * partners the user has an accepted `connections` row with are exposed, so this
 * integrates with the existing network system rather than duplicating it.
 *
 * This command intentionally implements ONLY the inbox/list + unread tracking.
 * The conversation screen and message-composing UI are deliberately not built
 * here; `sendMessage`/`markConversationRead` exist as the backing data logic.
 */

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

export type ConversationSummary = {
  // The other participant (never the signed-in user).
  userId: string
  name: string
  avatar: string
  headline: string
  // Latest message in the conversation, or null when none exists yet.
  lastMessage: string | null
  lastMessageAt: string | null
  // True when the latest message was sent by the signed-in user.
  lastMessageMine: boolean
  // Incoming messages from this person the signed-in user has not read.
  unreadCount: number
}

const PERSON_COLUMNS = {
  userId: profiles.userId,
  name: profiles.name,
  avatar: profiles.avatar,
  headline: profiles.headline,
  image: user.image,
}

/** The signed-in user's accepted connections (the people they can message). */
async function getConnectedPeople(meId: string) {
  return db
    .select(PERSON_COLUMNS)
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
}

/**
 * The signed-in user's inbox: one row per connected person, annotated with the
 * latest message preview, its time, and the unread-incoming count. Sorted by
 * most recent activity first; connected people with no messages yet appear
 * after active conversations, ordered by name. Never returns fake data.
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const meId = await getUserId()
  await ensureMessagesTable()

  const people = await getConnectedPeople(meId)

  // Every message the user is part of, newest first — so the first time we see
  // a given partner while iterating is that conversation's latest message.
  const myMessages = await db
    .select()
    .from(messages)
    .where(or(eq(messages.senderId, meId), eq(messages.recipientId, meId)))
    .orderBy(desc(messages.createdAt))

  type Agg = {
    lastMessage: string
    lastMessageAt: Date
    lastMessageMine: boolean
    unreadCount: number
  }
  const byOther = new Map<string, Agg>()
  for (const msg of myMessages) {
    const otherId = msg.senderId === meId ? msg.recipientId : msg.senderId
    const existing = byOther.get(otherId)
    if (!existing) {
      byOther.set(otherId, {
        lastMessage: msg.body,
        lastMessageAt: msg.createdAt,
        lastMessageMine: msg.senderId === meId,
        unreadCount: 0,
      })
    }
    // Unread = incoming (I am recipient) and not yet read.
    if (msg.recipientId === meId && msg.readAt === null) {
      const agg = byOther.get(otherId)!
      agg.unreadCount += 1
    }
  }

  const summaries: ConversationSummary[] = people.map((person) => {
    const agg = byOther.get(person.userId)
    return {
      userId: person.userId,
      name: person.name ?? 'Aspira member',
      avatar: person.avatar ?? person.image ?? '',
      headline: person.headline ?? '',
      lastMessage: agg?.lastMessage ?? null,
      lastMessageAt: agg?.lastMessageAt ? agg.lastMessageAt.toISOString() : null,
      lastMessageMine: agg?.lastMessageMine ?? false,
      unreadCount: agg?.unreadCount ?? 0,
    }
  })

  summaries.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) {
      return b.lastMessageAt.localeCompare(a.lastMessageAt)
    }
    if (a.lastMessageAt) return -1
    if (b.lastMessageAt) return 1
    return a.name.localeCompare(b.name)
  })

  return summaries
}

/**
 * Total unread incoming messages for the signed-in user. Drives the header
 * badge. The sender never counts their own messages because only rows where the
 * user is the recipient are considered.
 */
export async function getUnreadCount(): Promise<number> {
  const meId = await getUserId()
  await ensureMessagesTable()

  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.recipientId, meId), isNull(messages.readAt)))

  return rows.length
}

/**
 * Sends a message from the signed-in user to `recipientId`. Backing data logic
 * for the (not-yet-built) conversation screen; it validates the body, rejects
 * self-messaging, and requires an accepted connection so messaging stays
 * consistent with the network system.
 */
export async function sendMessage(
  recipientId: string,
  body: string,
): Promise<void> {
  const meId = await getUserId()

  const trimmed = (body ?? '').trim()
  if (!trimmed) throw new Error('Message cannot be empty.')
  if (!recipientId || recipientId === meId) {
    throw new Error('A valid recipient is required.')
  }

  const [connected] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'accepted'),
        or(
          and(
            eq(connections.requesterId, meId),
            eq(connections.recipientId, recipientId),
          ),
          and(
            eq(connections.requesterId, recipientId),
            eq(connections.recipientId, meId),
          ),
        ),
      ),
    )
    .limit(1)
  if (!connected) {
    throw new Error('You can only message your connections.')
  }

  await db.insert(messages).values({
    senderId: meId,
    recipientId,
    body: trimmed,
  })

  revalidatePath('/parent/messages')
}

/**
 * Marks every incoming message from `otherUserId` as read for the signed-in
 * user. Backing logic for read/unread tracking; the conversation screen (next
 * command) will call this when a conversation is opened.
 */
export async function markConversationRead(otherUserId: string): Promise<void> {
  const meId = await getUserId()
  if (!otherUserId) throw new Error('A valid person is required.')
  await ensureMessagesTable()

  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.recipientId, meId),
        eq(messages.senderId, otherUserId),
        isNull(messages.readAt),
      ),
    )

  revalidatePath('/parent/messages')
}
