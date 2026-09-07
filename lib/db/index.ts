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
