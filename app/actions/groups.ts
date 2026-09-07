'use server'

import { and, asc, desc, eq, inArray, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db, ensureGroupTables } from '@/lib/db'
import {
  connections,
  conversationMembers,
  conversations,
  messages,
  profiles,
  user,
} from '@/lib/db/schema'

/**
 * Group-chat data layer backed by the SAME Neon database, session handling, and
 * accepted-`connections` gate as the existing direct-message actions in
 * `messages.ts`. Nothing here touches or duplicates the one-to-one send/read
 * logic — direct messages remain the sender/recipient pair on `public.messages`
 * with a null `conversation_id`, while group messages carry a `conversation_id`
 * (and a null `recipient_id`). Every function derives the acting user from the
 * Better Auth session and authorizes membership server-side, so a non-member
 * can never read or post to a group by manipulating ids.
 */

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

const PERSON_COLUMNS = {
  userId: profiles.userId,
  name: profiles.name,
  avatar: profiles.avatar,
  headline: profiles.headline,
  image: user.image,
}

function firstName(name: string): string {
  return name.split(' ')[0] || name
}

export type GroupCandidate = {
  userId: string
  name: string
  avatar: string
  headline: string
}

/**
 * The signed-in user's accepted connections — the only people eligible to be
 * added to a group. Mirrors the direct-message connection gate exactly (an
 * accepted `connections` row in either direction), so group membership can
 * never include a pending request, a Discover user, or a follow relationship.
 */
export async function getGroupCandidates(): Promise<GroupCandidate[]> {
  const meId = await getUserId()

  const rows = await db
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

  return rows
    .map((person) => ({
      userId: person.userId,
      name: person.name ?? 'Aspira member',
      avatar: person.avatar ?? person.image ?? '',
      headline: person.headline ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The set of the signed-in user's accepted-connection user ids. */
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

  const ids = new Set<string>()
  for (const row of rows) {
    ids.add(row.requesterId === meId ? row.recipientId : row.requesterId)
  }
  return ids
}

/** True when the signed-in user is a member of `conversationId`. */
async function isMember(meId: string, conversationId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: conversationMembers.id })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, meId),
      ),
    )
    .limit(1)
  return Boolean(row)
}

/**
 * Creates a group conversation. Validates the name and that at least one other
 * member is selected, verifies (server-side) that every selected member is an
 * accepted connection of the creator, then creates the conversation and its
 * membership rows (creator always included, no duplicates). Returns the new
 * conversation id so the UI can open it immediately.
 */
export async function createGroup(
  name: string,
  memberIds: string[],
): Promise<string> {
  const meId = await getUserId()
  await ensureGroupTables()

  const trimmedName = (name ?? '').trim()
  if (!trimmedName) throw new Error('A group name is required.')

  // Unique, excluding the creator (added automatically below).
  const requested = Array.from(new Set(memberIds ?? [])).filter(
    (id) => id && id !== meId,
  )
  if (requested.length === 0) {
    throw new Error('Select at least one connection to add to the group.')
  }

  // Never trust the client list: every member must be an accepted connection.
  const allowed = await acceptedConnectionIds(meId)
  const invalid = requested.filter((id) => !allowed.has(id))
  if (invalid.length > 0) {
    throw new Error('You can only add your accepted connections to a group.')
  }

  const [conversation] = await db
    .insert(conversations)
    .values({ type: 'group', name: trimmedName, createdBy: meId })
    .returning({ id: conversations.id })

  const now = new Date()
  await db
    .insert(conversationMembers)
    .values([
      // Creator starts caught up so their own new group shows no unread.
      { conversationId: conversation.id, userId: meId, lastReadAt: now },
      ...requested.map((userId) => ({
        conversationId: conversation.id,
        userId,
      })),
    ])
    .onConflictDoNothing()

  revalidatePath('/parent/messages')
  return conversation.id
}

export type GroupSummary = {
  conversationId: string
  name: string
  memberCount: number
  lastMessage: string | null
  lastMessageAt: string | null
  lastMessageMine: boolean
  // First name of the last sender, for the "Name: preview" left-column style.
  lastMessageSenderName: string | null
  unreadCount: number
}

/**
 * Every group the signed-in user belongs to, annotated with member count, the
 * latest message preview/time/sender, and the user-specific unread count
 * (messages after the member's `last_read_at` that they did not send). Sorted
 * newest-activity first. Never returns groups the user is not a member of.
 */
export async function getGroupConversations(): Promise<GroupSummary[]> {
  const meId = await getUserId()
  await ensureGroupTables()

  const myMemberships = await db
    .select({
      conversationId: conversationMembers.conversationId,
      lastReadAt: conversationMembers.lastReadAt,
    })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, meId))

  const convoIds = myMemberships.map((m) => m.conversationId)
  if (convoIds.length === 0) return []

  const lastReadByConvo = new Map<string, Date | null>(
    myMemberships.map((m) => [m.conversationId, m.lastReadAt]),
  )

  const convoRows = await db
    .select({ id: conversations.id, name: conversations.name })
    .from(conversations)
    .where(inArray(conversations.id, convoIds))

  const memberRows = await db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(inArray(conversationMembers.conversationId, convoIds))

  const memberCountByConvo = new Map<string, number>()
  for (const row of memberRows) {
    memberCountByConvo.set(
      row.conversationId,
      (memberCountByConvo.get(row.conversationId) ?? 0) + 1,
    )
  }

  const msgRows = await db
    .select({
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      senderName: profiles.name,
      body: messages.body,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.userId, messages.senderId))
    .where(inArray(messages.conversationId, convoIds))
    .orderBy(desc(messages.createdAt))

  type Agg = {
    lastMessage: string
    lastMessageAt: Date
    lastMessageMine: boolean
    lastMessageSenderName: string | null
    unreadCount: number
  }
  const byConvo = new Map<string, Agg>()
  for (const msg of msgRows) {
    const convoId = msg.conversationId!
    const lastRead = lastReadByConvo.get(convoId) ?? null
    if (!byConvo.has(convoId)) {
      byConvo.set(convoId, {
        lastMessage: msg.body,
        lastMessageAt: msg.createdAt,
        lastMessageMine: msg.senderId === meId,
        lastMessageSenderName: msg.senderName ? firstName(msg.senderName) : null,
        unreadCount: 0,
      })
    }
    // Unread = not mine and newer than my read watermark for this group.
    const isUnread =
      msg.senderId !== meId &&
      (lastRead === null || msg.createdAt > lastRead)
    if (isUnread) byConvo.get(convoId)!.unreadCount += 1
  }

  const summaries: GroupSummary[] = convoRows.map((convo) => {
    const agg = byConvo.get(convo.id)
    return {
      conversationId: convo.id,
      name: convo.name ?? 'Group',
      memberCount: memberCountByConvo.get(convo.id) ?? 0,
      lastMessage: agg?.lastMessage ?? null,
      lastMessageAt: agg?.lastMessageAt ? agg.lastMessageAt.toISOString() : null,
      lastMessageMine: agg?.lastMessageMine ?? false,
      lastMessageSenderName: agg?.lastMessageSenderName ?? null,
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

export type GroupMember = {
  userId: string
  name: string
  avatar: string
}

export type GroupMessage = {
  id: string
  body: string
  mine: boolean
  senderId: string
  senderName: string
  senderAvatar: string
  createdAt: string
}

export type GroupConversationDetail = {
  conversation: {
    id: string
    name: string
    memberCount: number
    members: GroupMember[]
  }
  messages: GroupMessage[]
}

/**
 * Full group conversation for the signed-in user: header info, member list, and
 * every message oldest-first with its sender identified. Returns null when the
 * user is not a member, so membership is enforced server-side and the messages
 * cannot be read by manipulating the conversation id.
 */
export async function getGroupConversation(
  conversationId: string,
): Promise<GroupConversationDetail | null> {
  const meId = await getUserId()
  if (!conversationId) return null
  await ensureGroupTables()

  if (!(await isMember(meId, conversationId))) return null

  const [convo] = await db
    .select({ id: conversations.id, name: conversations.name })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (!convo) return null

  const memberRows = await db
    .select(PERSON_COLUMNS)
    .from(conversationMembers)
    .leftJoin(profiles, eq(profiles.userId, conversationMembers.userId))
    .leftJoin(user, eq(user.id, conversationMembers.userId))
    .where(eq(conversationMembers.conversationId, conversationId))

  const members: GroupMember[] = memberRows.map((m) => ({
    userId: m.userId,
    name: m.name ?? 'Aspira member',
    avatar: m.avatar ?? m.image ?? '',
  }))

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      senderId: messages.senderId,
      senderName: profiles.name,
      senderAvatar: profiles.avatar,
      senderImage: user.image,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .leftJoin(profiles, eq(profiles.userId, messages.senderId))
    .leftJoin(user, eq(user.id, messages.senderId))
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  return {
    conversation: {
      id: convo.id,
      name: convo.name ?? 'Group',
      memberCount: members.length,
      members,
    },
    messages: rows.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderId === meId,
      senderId: m.senderId,
      senderName: m.senderName ?? 'Aspira member',
      senderAvatar: m.senderAvatar ?? m.senderImage ?? '',
      createdAt: m.createdAt.toISOString(),
    })),
  }
}

/**
 * Sends a message to a group. Validates the body and that the signed-in user is
 * a member (server-side), then writes to the EXISTING `public.messages` table
 * with `conversation_id` set and `recipient_id` null — the same table and write
 * discipline as direct messaging, not a separate mechanism.
 */
export async function sendGroupMessage(
  conversationId: string,
  body: string,
): Promise<void> {
  const meId = await getUserId()
  await ensureGroupTables()

  const trimmed = (body ?? '').trim()
  if (!trimmed) throw new Error('Message cannot be empty.')
  if (!conversationId) throw new Error('A valid group is required.')
  if (!(await isMember(meId, conversationId))) {
    throw new Error('You can only message groups you belong to.')
  }

  await db.insert(messages).values({
    senderId: meId,
    conversationId,
    body: trimmed,
  })

  // Bump the group's activity time and keep the sender caught up.
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId))
  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, meId),
      ),
    )

  revalidatePath('/parent/messages')
}

/**
 * Marks the group as read for the signed-in user by advancing only their own
 * `last_read_at` watermark. Per-user and per-group: it never affects another
 * member's read state or any other conversation, and it never touches the
 * direct-message `read_at` column.
 */
export async function markGroupRead(conversationId: string): Promise<void> {
  const meId = await getUserId()
  if (!conversationId) throw new Error('A valid group is required.')
  await ensureGroupTables()

  if (!(await isMember(meId, conversationId))) return

  await db
    .update(conversationMembers)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, meId),
      ),
    )

  revalidatePath('/parent/messages')
}
