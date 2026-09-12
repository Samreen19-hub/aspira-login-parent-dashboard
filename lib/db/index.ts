import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

/**
 * Single shared pg Pool used by BOTH Better Auth and Drizzle.
 *
 * The Better Auth tables live in the `neon_auth` schema while this app's own
 * tables (profiles, connections) live in `public`. Better Auth issues
 * unqualified table names, so we widen the connection `search_path` to resolve
 * `user`/`session`/`account`/`verification` from `neon_auth` and everything
 * else from `public`.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// The pooled Neon endpoint (PgBouncer) rejects `search_path` as a startup
// parameter, so set it as a regular `SET` query on each new connection instead.
pool.on('connect', (client) => {
  client.query('SET search_path TO neon_auth, public')
})

export const db = drizzle(pool, { schema })

/**
 * Lazily provisions the `public.follows` table (and its unique-pair index) on
 * the live database using the shared pool. No follow structure existed in the
 * schema, so the app owns its minimal DDL here — idempotent (`IF NOT EXISTS`),
 * memoized per process, and explicitly schema-qualified so it always lands in
 * `public` rather than the first entry (`neon_auth`) of the `search_path`.
 */
let followsReady: Promise<void> | null = null
export function ensureFollowsTable(): Promise<void> {
  if (!followsReady) {
    followsReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.follows (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          follower_id uuid NOT NULL,
          following_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS follows_unique_pair
        ON public.follows (follower_id, following_id)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      followsReady = null
      throw error
    })
  }
  return followsReady
}

/**
 * Lazily provisions the `public.messages` table (and supporting indexes) using
 * the shared pool, following the same idempotent, memoized, schema-qualified
 * pattern as `ensureFollowsTable`. Two indexes cover the hot paths: unread
 * lookups by recipient and per-pair history ordered by time.
 */
let messagesReady: Promise<void> | null = null
export function ensureMessagesTable(): Promise<void> {
  if (!messagesReady) {
    messagesReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.messages (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          sender_id uuid NOT NULL,
          recipient_id uuid NOT NULL,
          body text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          read_at timestamptz
        )
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS messages_recipient_unread
        ON public.messages (recipient_id, read_at)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS messages_pair_created
        ON public.messages (sender_id, recipient_id, created_at)
      `)
      // Additive group-message support kept here so the column always exists no
      // matter which code path (direct or group) provisions the table first.
      // Both are backward compatible and preserve every existing 1-to-1 row:
      // `conversation_id` is nullable (null for all direct messages) and
      // `recipient_id` is relaxed to nullable so a group message can omit it.
      await pool.query(`
        ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid
      `)
      await pool.query(`
        ALTER TABLE public.messages ALTER COLUMN recipient_id DROP NOT NULL
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS messages_conversation_created
        ON public.messages (conversation_id, created_at)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      messagesReady = null
      throw error
    })
  }
  return messagesReady
}

/**
 * Lazily provisions the group-chat tables (`public.conversations`,
 * `public.conversation_members`) and the minimal, backward-compatible
 * extensions to `public.messages` needed for group messages, following the
 * same idempotent, memoized, schema-qualified pattern as the helpers above.
 *
 * The `messages` changes are additive and preserve all existing 1-to-1 data:
 * a nullable `conversation_id` column is added, and `recipient_id` is relaxed
 * to nullable so a group message (which targets a conversation, not a single
 * person) can omit it. Existing direct rows keep their non-null `recipient_id`.
 */
let groupTablesReady: Promise<void> | null = null
export function ensureGroupTables(): Promise<void> {
  if (!groupTablesReady) {
    groupTablesReady = (async () => {
      // The direct-message table must exist first — we extend it below.
      await ensureMessagesTable()

      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.conversations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          type text NOT NULL DEFAULT 'group',
          name text,
          created_by uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.conversation_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id uuid NOT NULL,
          user_id uuid NOT NULL,
          joined_at timestamptz NOT NULL DEFAULT now(),
          last_read_at timestamptz
        )
      `)
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_unique
        ON public.conversation_members (conversation_id, user_id)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS conversation_members_user
        ON public.conversation_members (user_id)
      `)

      // Additive, backward-compatible extensions to the existing messages table.
      await pool.query(`
        ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid
      `)
      await pool.query(`
        ALTER TABLE public.messages ALTER COLUMN recipient_id DROP NOT NULL
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS messages_conversation_created
        ON public.messages (conversation_id, created_at)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      groupTablesReady = null
      throw error
    })
  }
  return groupTablesReady
}

/**
 * Lazily provisions the `public.notifications` table (and its two supporting
 * indexes) using the shared pool, following the exact same idempotent,
 * memoized, schema-qualified pattern as the helpers above. No foreign keys to
 * `neon_auth` — matching the existing Aspira convention. The indexes cover the
 * two hot paths: listing a recipient's notifications newest-first, and counting
 * a recipient's unread notifications.
 */
let notificationsReady: Promise<void> | null = null
export function ensureNotificationsTable(): Promise<void> {
  if (!notificationsReady) {
    notificationsReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.notifications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient_id uuid NOT NULL,
          actor_id uuid,
          type text NOT NULL,
          entity_id uuid,
          body text,
          read_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS notifications_recipient_created
        ON public.notifications (recipient_id, created_at DESC)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS notifications_recipient_unread
        ON public.notifications (recipient_id, read_at)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      notificationsReady = null
      throw error
    })
  }
  return notificationsReady
}

/**
 * Lazily provisions the DB-backed User Posts tables (`public.posts`,
 * `public.post_likes`, `public.post_comments`, `public.poll_votes`,
 * `public.event_rsvps`) and their supporting indexes/constraints, following the
 * exact same idempotent (`IF NOT EXISTS`), memoized, schema-qualified pattern as
 * the helpers above. No foreign keys to `neon_auth`, matching the existing
 * Aspira convention. This is purely additive: it creates new tables only and
 * never touches any existing table or data.
 *
 * Uniqueness that makes interactions idempotent (a single like / vote / rsvp
 * per user per post) is enforced by unique indexes here rather than inline
 * constraints, so the server actions can rely on plain upsert/toggle logic.
 */
let postsReady: Promise<void> | null = null
export function ensurePostsTables(): Promise<void> {
  if (!postsReady) {
    postsReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.posts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          author_id uuid NOT NULL,
          type text NOT NULL,
          body text,
          scope text,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // Feed queries filter by scope (null = Home, slug = space) and sort newest
      // first; the author index covers "posts by this user" lookups.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_scope_created
        ON public.posts (scope, created_at DESC)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_author
        ON public.posts (author_id)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.post_likes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One like per user per post -> makes the like a pure toggle and the count
      // a COUNT(*).
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS post_likes_unique
        ON public.post_likes (post_id, user_id)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS post_likes_post
        ON public.post_likes (post_id)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.post_comments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL,
          author_id uuid NOT NULL,
          body text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS post_comments_post_created
        ON public.post_comments (post_id, created_at)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.poll_votes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL,
          user_id uuid NOT NULL,
          option_index integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One vote per user per poll -> changing a vote is an upsert on this key.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_unique
        ON public.poll_votes (post_id, user_id)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS poll_votes_post
        ON public.poll_votes (post_id)
      `)

      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.event_rsvps (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL,
          user_id uuid NOT NULL,
          status text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One RSVP per user per event post -> setting/updating an RSVP is an upsert.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_unique
        ON public.event_rsvps (post_id, user_id)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS event_rsvps_post
        ON public.event_rsvps (post_id)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      postsReady = null
      throw error
    })
  }
  return postsReady
}

/**
 * Lazily provisions the `public.post_hides` table (and its supporting indexes)
 * using the shared pool, following the exact same idempotent (`IF NOT EXISTS`),
 * memoized, schema-qualified pattern as the helpers above. This is a purely
 * additive, viewer-scoped filter table: a row means "this user hid this post
 * from their own feed" and never touches the post itself or its interactions.
 * No foreign keys to `neon_auth`, matching the existing Aspira convention.
 */
let postHidesReady: Promise<void> | null = null
export function ensurePostHidesTable(): Promise<void> {
  if (!postHidesReady) {
    postHidesReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.post_hides (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id uuid NOT NULL,
          user_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One hide per user per post -> hiding is idempotent and unhiding is an
      // exact-match delete.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS post_hides_unique
        ON public.post_hides (post_id, user_id)
      `)
      // Covers "posts hidden by this viewer" lookups done while building a feed.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS post_hides_user
        ON public.post_hides (user_id)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      postHidesReady = null
      throw error
    })
  }
  return postHidesReady
}
