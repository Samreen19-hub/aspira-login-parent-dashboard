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
