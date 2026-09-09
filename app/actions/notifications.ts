'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db, ensureMessagesTable, ensureNotificationsTable } from '@/lib/db'
import {
  conversationMembers,
  messages,
  notifications,
  profiles,
  user,
} from '@/lib/db/schema'

/**
 * Persistent per-user notifications backed by the SAME Neon database, Better
 * Auth session handling, and lazy-table + server-action conventions already
 * used by the messaging and network features. `public.notifications` is the
 * single source of truth (see `ensureNotificationsTable` in `lib/db/index.ts`).
 *
 * Security model, enforced entirely server-side:
 *   - The actor of a created notification is ALWAYS the authenticated session
 *     user — the browser can never supply or spoof `actor_id`.
 *   - Reads and mutations are always scoped to the authenticated recipient, so
 *     one user can never see or mark another user's notifications.
 *   - Notification creation is best-effort: a failure here never breaks the
 *     underlying message / connection / follow action that triggered it.
 *
 * Delivery is intentionally polling-based for now (the client store uses the
 * same 4s SWR interval as messaging); this table and these actions stay the
 * same when a true realtime transport is added later.
 */

/** Notification kinds emitted in this phase. */
export type NotificationType =
  | 'message'
  | 'group_message'
  | 'connection_request'
  | 'connection_accepted'
  | 'follow'

export type NotificationView = {
  id: string
  type: string
  actorId: string | null
  actorName: string | null
  actorAvatar: string | null
  entityId: string | null
  body: string | null
  read: boolean
  createdAt: string
}

/** The authenticated recipient for reads/mutations. Throws when signed out. */
async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

/**
 * The authenticated actor for CREATION only. Returns null instead of throwing
 * so the best-effort creation helpers below can quietly no-op when there is no
 * session, never surfacing an error into the triggering action.
 */
async function getActorIdOrNull(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user?.id ?? null
  } catch {
    return null
  }
}

type CreateInput = {
  recipientId: string
  type: NotificationType
  entityId?: string | null
  body?: string | null
}

/**
 * Creates ONE notification. Best-effort: any failure (including a missing
 * session) is caught and logged so the primary action still succeeds. The
 * actor is resolved from the session here — callers never pass an actor id.
 * Self-notifications are dropped (a user is never notified about their own act).
 */
export async function createNotification(input: CreateInput): Promise<void> {
  try {
    const actorId = await getActorIdOrNull()
    if (!actorId) return
    if (!input.recipientId || input.recipientId === actorId) return

    await ensureNotificationsTable()
    await db.insert(notifications).values({
      recipientId: input.recipientId,
      actorId,
      type: input.type,
      entityId: input.entityId ?? null,
      body: input.body ?? null,
    })
  } catch (error) {
    console.error('[v0] createNotification failed:', error)
  }
}

type CreateManyInput = {
  recipientIds: string[]
  type: NotificationType
  entityId?: string | null
  body?: string | null
}

/**
 * Creates one notification per recipient (used for group messages). Best-effort
 * like `createNotification`: the actor is the session user, the actor is never
 * a recipient of their own notification, and recipient ids are de-duplicated.
 */
export async function createNotifications(input: CreateManyInput): Promise<void> {
  try {
    const actorId = await getActorIdOrNull()
    if (!actorId) return

    const recipients = Array.from(new Set(input.recipientIds ?? [])).filter(
      (id) => id && id !== actorId,
    )
    if (recipients.length === 0) return

    await ensureNotificationsTable()
    await db.insert(notifications).values(
      recipients.map((recipientId) => ({
        recipientId,
        actorId,
        type: input.type,
        entityId: input.entityId ?? null,
        body: input.body ?? null,
      })),
    )
  } catch (error) {
    console.error('[v0] createNotifications failed:', error)
  }
}

/**
 * The signed-in user's notifications, newest first, annotated with the actor's
 * display name and avatar. Scoped strictly to the authenticated recipient.
 */
export async function getNotifications(): Promise<NotificationView[]> {
  const meId = await getUserId()
  await ensureNotificationsTable()

  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      actorId: notifications.actorId,
      entityId: notifications.entityId,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actorName: profiles.name,
      actorAvatar: profiles.avatar,
      actorImage: user.image,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .leftJoin(user, eq(user.id, notifications.actorId))
    .where(eq(notifications.recipientId, meId))
    .orderBy(desc(notifications.createdAt))

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    actorId: row.actorId,
    actorName: row.actorName ?? null,
    actorAvatar: row.actorAvatar ?? row.actorImage ?? null,
    entityId: row.entityId,
    body: row.body,
    read: row.readAt !== null,
    createdAt: row.createdAt.toISOString(),
  }))
}

/**
 * Resolves the group conversation a `group_message` notification points at.
 *
 * The `entity_id` on a group_message notification is the specific `messages.id`
 * (see `sendGroupMessage`), NOT the conversation. To open the correct group
 * chat we look up that existing message row and return its `conversation_id`,
 * reusing the existing messages data — no new column, table, or id is created.
 * The read is scoped to a group the signed-in user actually belongs to, so a
 * user can never resolve a conversation they are not a member of. Returns null
 * when the message no longer exists or is not a group message.
 */
export async function resolveGroupConversationId(
  messageId: string,
): Promise<string | null> {
  const meId = await getUserId()
  if (!messageId) return null
  await ensureMessagesTable()

  const rows = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .innerJoin(
      conversationMembers,
      eq(conversationMembers.conversationId, messages.conversationId),
    )
    .where(and(eq(messages.id, messageId), eq(conversationMembers.userId, meId)))
    .limit(1)

  return rows[0]?.conversationId ?? null
}

/**
 * Count of the signed-in user's unread notifications. Scoped to the
 * authenticated recipient; drives the header bell badge.
 */
export async function getUnreadCount(): Promise<number> {
  const meId = await getUserId()
  await ensureNotificationsTable()

  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.recipientId, meId), isNull(notifications.readAt)),
    )

  return rows.length
}

/**
 * Marks a single notification read. The WHERE clause pins BOTH the id and the
 * authenticated recipient, so a user can never mark another user's
 * notification as read.
 */
export async function markRead(notificationId: string): Promise<void> {
  const meId = await getUserId()
  if (!notificationId) throw new Error('A valid notification is required.')
  await ensureNotificationsTable()

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientId, meId),
      ),
    )

  revalidatePath('/parent/notifications')
}

/**
 * Marks every one of the signed-in user's unread notifications read. Scoped to
 * the authenticated recipient.
 */
export async function markAllRead(): Promise<void> {
  const meId = await getUserId()
  await ensureNotificationsTable()

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.recipientId, meId), isNull(notifications.readAt)),
    )

  revalidatePath('/parent/notifications')
}
