'use server'

import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
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
 * The other participants in the signed-in user's existing DIRECT conversations.
 * A direct message is a `public.messages` row with a concrete `recipient_id`
 * and no `conversation_id` (group messages set `conversation_id` and are
 * excluded). This is independent of the connection status, so a conversation
 * survives after the two users disconnect — its stored messages are its history.
 */
async function getDirectMessagePeople(meId: string) {
  return db
    .selectDistinctOn([profiles.userId], PERSON_COLUMNS)
    .from(messages)
    .innerJoin(
      profiles,
      or(
        and(
          eq(messages.senderId, meId),
          eq(profiles.userId, messages.recipientId),
        ),
        and(
          eq(messages.recipientId, meId),
          eq(profiles.userId, messages.senderId),
        ),
      ),
    )
    .leftJoin(user, eq(user.id, profiles.userId))
    .where(isNull(messages.conversationId))
}

/**
 * True when a direct (one-to-one) conversation already exists between the
 * signed-in user and `otherUserId` — i.e. at least one `public.messages` row in
 * either direction with no `conversation_id`. Used so an existing conversation
 * stays openable and sendable even after the connection is removed.
 */
async function hasExistingDirectConversation(
  meId: string,
  otherUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        isNull(messages.conversationId),
        or(
          and(
            eq(messages.senderId, meId),
            eq(messages.recipientId, otherUserId),
          ),
          and(
            eq(messages.senderId, otherUserId),
            eq(messages.recipientId, meId),
          ),
        ),
      ),
    )
    .limit(1)
  return Boolean(row)
}

/** True when the two users currently have an accepted connection. */
async function hasAcceptedConnection(
  meId: string,
  otherUserId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(
      and(
        eq(connections.status, 'accepted'),
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
      ),
    )
    .limit(1)
  return Boolean(row)
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

  // The inbox is the UNION of two sets:
  //   1. people the user currently has an accepted connection with, and
  //   2. people the user already has a direct conversation with.
  // Set (2) keeps an existing 1-to-1 chat visible after the connection is
  // removed, while a mere past connection with no messages never appears
  // (it is not in either set once disconnected). De-duplicated by userId.
  const [connectedPeople, directPeople] = await Promise.all([
    getConnectedPeople(meId),
    getDirectMessagePeople(meId),
  ])
  const peopleById = new Map<string, (typeof connectedPeople)[number]>()
  for (const person of connectedPeople) peopleById.set(person.userId, person)
  for (const person of directPeople) {
    if (!peopleById.has(person.userId)) peopleById.set(person.userId, person)
  }
  const people = Array.from(peopleById.values())

  // Every message the user is part of, newest first — so the first time we see
  // a given partner while iterating is that conversation's latest message.
  const myMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        isNull(messages.conversationId),
        or(eq(messages.senderId, meId), eq(messages.recipientId, meId)),
      ),
    )
    .orderBy(desc(messages.createdAt))

  type Agg = {
    lastMessage: string
    lastMessageAt: Date
    lastMessageMine: boolean
    unreadCount: number
  }
  const byOther = new Map<string, Agg>()
  for (const msg of myMessages) {
    // Direct messages only (group messages are already filtered out above), so
    // the non-me party is always a concrete user id; skip defensively if not.
    const otherId = msg.senderId === meId ? msg.recipientId : msg.senderId
    if (!otherId) continue
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

export type ConversationMessage = {
  id: string
  body: string
  // True when the signed-in user sent the message (render on the right).
  mine: boolean
  createdAt: string
  readAt: string | null
}

export type ConversationDetail = {
  person: {
    userId: string
    name: string
    avatar: string
    headline: string
  }
  messages: ConversationMessage[]
}

/**
 * Full one-to-one conversation between the signed-in user and `otherUserId`:
 * the other person's profile plus every message in the pair, oldest first.
 *
 * A conversation is the unordered pair, so it selects rows where the two users
 * are (sender, recipient) in either direction. Reuses the existing
 * `public.messages` table and the same accepted-connection gate as
 * `sendMessage`, so only real connections are viewable. Returns null when the
 * pair is not an accepted connection or the person has no profile — never fake
 * data. Read-only: it performs no mutation (marking read is a separate action).
 */
export async function getConversation(
  otherUserId: string,
): Promise<ConversationDetail | null> {
  const meId = await getUserId()
  if (!otherUserId || otherUserId === meId) return null
  await ensureMessagesTable()

  // Viewable when the pair is an accepted connection OR an existing direct
  // conversation already exists between them — so removing the connection does
  // not hide (or destroy) a conversation the two users already had.
  const [connected, hasConversation] = await Promise.all([
    hasAcceptedConnection(meId, otherUserId),
    hasExistingDirectConversation(meId, otherUserId),
  ])
  if (!connected && !hasConversation) return null

  const [person] = await db
    .select(PERSON_COLUMNS)
    .from(profiles)
    .leftJoin(user, eq(user.id, profiles.userId))
    .where(eq(profiles.userId, otherUserId))
    .limit(1)
  if (!person) return null

  const rows = await db
    .select()
    .from(messages)
    .where(
      or(
        and(
          eq(messages.senderId, meId),
          eq(messages.recipientId, otherUserId),
        ),
        and(
          eq(messages.senderId, otherUserId),
          eq(messages.recipientId, meId),
        ),
      ),
    )
    .orderBy(asc(messages.createdAt))

  return {
    person: {
      userId: person.userId,
      name: person.name ?? 'Aspira member',
      avatar: person.avatar ?? person.image ?? '',
      headline: person.headline ?? '',
    },
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === meId,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt ? m.readAt.toISOString() : null,
    })),
  }
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

  // Allowed when the pair is an accepted connection OR they already have an
  // existing direct conversation. The latter lets users keep replying in a
  // conversation that predates a disconnect, without re-opening messaging to
  // people they never had a conversation with.
  const [connected, hasConversation] = await Promise.all([
    hasAcceptedConnection(meId, recipientId),
    hasExistingDirectConversation(meId, recipientId),
  ])
  if (!connected && !hasConversation) {
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

/**
 * Permanently deletes the one-to-one conversation between the signed-in user
 * and `otherUserId`: every DIRECT `public.messages` row in either direction
 * (`conversation_id IS NULL`). It is scoped to exactly this pair, so no other
 * conversation is touched, and the `conversation_id IS NULL` filter guarantees
 * group messages can never match. It deliberately does NOT touch profiles, the
 * `connections` row, or follows — the two users stay connected and can start a
 * fresh direct chat afterwards via New Message.
 */
export async function deleteConversation(otherUserId: string): Promise<void> {
  const meId = await getUserId()
  if (!otherUserId || otherUserId === meId) {
    throw new Error('A valid person is required.')
  }
  await ensureMessagesTable()

  await db
    .delete(messages)
    .where(
      and(
        isNull(messages.conversationId),
        or(
          and(
            eq(messages.senderId, meId),
            eq(messages.recipientId, otherUserId),
          ),
          and(
            eq(messages.senderId, otherUserId),
            eq(messages.recipientId, meId),
          ),
        ),
      ),
    )

  revalidatePath('/parent/messages')
}
