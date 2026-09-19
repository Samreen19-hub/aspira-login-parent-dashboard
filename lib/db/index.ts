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
 * Lazily provisions the `public.space_members` table (and its supporting
 * indexes) using the shared pool, following the exact same idempotent
 * (`IF NOT EXISTS`), memoized, schema-qualified pattern as the helpers above.
 * This single, purely additive table backs Groups membership, Communities
 * following, and admin ownership (`role`) for the social pages. It is unrelated
 * to the group-chat `conversation_members` table. No foreign keys to
 * `neon_auth`, matching the existing Aspira convention. The unique
 * `(slug, user_id)` index makes join/follow idempotent; the `slug` index covers
 * per-space roster and count lookups.
 */
let spaceMembersReady: Promise<void> | null = null
export function ensureSpaceMembersTable(): Promise<void> {
  if (!spaceMembersReady) {
    spaceMembersReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.space_members (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug text NOT NULL,
          user_id uuid NOT NULL,
          role text NOT NULL DEFAULT 'member',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One membership row per user per space -> join/follow is idempotent and
      // a role change (member <-> admin) is a plain update.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS space_members_unique
        ON public.space_members (slug, user_id)
      `)
      // Covers roster and member-count lookups for a single space.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS space_members_slug
        ON public.space_members (slug)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      spaceMembersReady = null
      throw error
    })
  }
  return spaceMembersReady
}

/**
 * Lazily provisions the `public.spaces` table (and its supporting indexes)
 * using the shared pool, following the exact same idempotent (`IF NOT EXISTS`),
 * memoized, schema-qualified pattern as the helpers above. This is the source
 * of truth for the EXISTENCE and metadata of a Groups/Communities space,
 * replacing the previous hardcoded `SOCIAL_SPACES` + localStorage arrangement.
 * It sits ALONGSIDE `public.space_members`/`public.space_invitations` (which
 * remain the source of truth for membership and invitations) and never
 * duplicates them. `kind` is `group | community`. `created_by` is nullable so
 * the seeded built-in spaces can be system-owned (NULL). No foreign keys to
 * `neon_auth`, matching the existing Aspira convention. This helper only creates
 * the table; seeding the built-in spaces is done idempotently in the spaces
 * action layer so this low-level module stays free of app data.
 */
let spacesReady: Promise<void> | null = null
export function ensureSpacesTable(): Promise<void> {
  if (!spacesReady) {
    spacesReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.spaces (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug text NOT NULL,
          kind text NOT NULL,
          title text NOT NULL,
          category text,
          description text,
          privacy text NOT NULL DEFAULT 'Public',
          created_by uuid,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // Additive, backward-compatible GROUP access-control column. The DEFAULT
      // ensures every pre-existing space row (built-in or user-created) inherits
      // the prior unrestricted "anyone can join" behavior, so no current member
      // is ever locked out by this migration. Communities ignore this value.
      await pool.query(`
        ALTER TABLE public.spaces
        ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'anyone'
      `)
      // One space per slug -> seeding/creating is idempotent and every posts,
      // membership, and invitation row keyed by slug resolves to exactly one
      // space definition.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS spaces_slug_unique
        ON public.spaces (slug)
      `)
      // Covers the listing pages' per-kind (groups vs communities) filtering.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS spaces_kind
        ON public.spaces (kind)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      spacesReady = null
      throw error
    })
  }
  return spacesReady
}

/**
 * Lazily provisions the `public.space_invitations` table (and its supporting
 * indexes) using the shared pool, following the exact same idempotent
 * (`IF NOT EXISTS`), memoized, schema-qualified pattern as the helpers above.
 * This is a purely additive table that backs REAL pending invitations to a
 * Groups/Communities space. It sits ALONGSIDE `public.space_members` and never
 * modifies it: an invitation is not membership — membership is created only when
 * a recipient accepts. It is unrelated to the group-chat tables. No foreign keys
 * to `neon_auth.user`, matching the existing Aspira convention.
 *
 * `status` is free-text capable of `pending | accepted | declined | cancelled`.
 * The PARTIAL unique index enforces "no duplicate ACTIVE invitation" — only one
 * `pending` row may exist per `(space_slug, invitee_id)` — while still allowing a
 * fresh invitation after a previous one was declined/cancelled. The slug index
 * covers per-space pending-invitation lookups.
 */
let spaceInvitationsReady: Promise<void> | null = null
export function ensureSpaceInvitationsTable(): Promise<void> {
  if (!spaceInvitationsReady) {
    spaceInvitationsReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.space_invitations (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          space_slug text NOT NULL,
          inviter_id uuid NOT NULL,
          invitee_id uuid NOT NULL,
          status text NOT NULL DEFAULT 'pending',
          created_at timestamptz NOT NULL DEFAULT now(),
          responded_at timestamptz
        )
      `)
      // Only ONE active (pending) invitation may exist per space+invitee. A
      // partial index lets a new invitation be sent again after a prior one was
      // declined/cancelled, since those rows are excluded from the constraint.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS space_invitations_pending_unique
        ON public.space_invitations (space_slug, invitee_id)
        WHERE status = 'pending'
      `)
      // Covers per-space pending-invitation roster lookups.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS space_invitations_slug
        ON public.space_invitations (space_slug)
      `)
      // Covers "invitations addressed to me" lookups for a recipient inbox.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS space_invitations_invitee
        ON public.space_invitations (invitee_id)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      spaceInvitationsReady = null
      throw error
    })
  }
  return spaceInvitationsReady
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

/**
 * Lazily provisions the parent-child tables (schema: public) using the shared
 * pool, following the exact same idempotent (`IF NOT EXISTS`), memoized,
 * schema-qualified pattern as the helpers above. No foreign keys to `neon_auth`,
 * matching the existing Aspira convention.
 *
 * `public.parent_child` is the single source of truth for a parent's children.
 * `parent_user_id` is ALWAYS the authenticated session user at write time, never
 * trusted from the browser. Only account-less children are supported today, so
 * `child_user_id` stays nullable (reserved for future real-student linking) and
 * `status` defaults to `unlinked`. There is intentionally NO progress/
 * performance column.
 *
 * `public.parent_child_seeds` is a tiny per-parent marker table so the built-in
 * demo children (Aarav/Saanvi) are seeded at most ONCE for the demo parent and
 * never reappear after they are deleted. It exists purely to make the one-time
 * seed safe and idempotent; it stores no child data.
 */
let parentChildReady: Promise<void> | null = null
export function ensureParentChildTable(): Promise<void> {
  if (!parentChildReady) {
    parentChildReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.parent_child (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          parent_user_id uuid NOT NULL,
          child_user_id uuid,
          status text NOT NULL DEFAULT 'unlinked',
          name text NOT NULL,
          class_name text,
          school text,
          relationship text,
          dob text,
          avatar text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // Covers "list this parent's children, oldest first" — the only hot path.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS parent_child_parent_created
        ON public.parent_child (parent_user_id, created_at)
      `)
      // One-time seed marker per parent. The PK makes claiming the marker an
      // atomic, race-safe "seed exactly once" guard.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.parent_child_seeds (
          parent_user_id uuid PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      parentChildReady = null
      throw error
    })
  }
  return parentChildReady
}

/**
 * Lazily provisions the SHARED school foundation tables (schema: public) using
 * the shared pool, following the exact same idempotent (`IF NOT EXISTS`),
 * memoized, schema-qualified pattern as the helpers above. This is a purely
 * ADDITIVE foundation — it creates new tables only and never resets, replaces,
 * or seeds any data. It establishes the single canonical relationship
 *
 *   school_admin (user) -> school -> enrollment -> student <- parent_child
 *
 * so a parent, a school admin, and (eventually) a student all resolve to the
 * SAME canonical records rather than per-role copies.
 *
 * Tables created here (all in `public`):
 *  - `students`      Canonical student entity with a stable UUID. `user_id` is
 *                    reserved for a FUTURE real student account link to
 *                    `neon_auth.user.id` (NOT implemented here) and stays
 *                    nullable, mirroring the existing `parent_child.child_user_id`
 *                    convention. No foreign key to `neon_auth`.
 *  - `schools`       Minimal school record (id, name, timestamps).
 *  - `school_admins` Authoritative `school_id <-> user_id` membership. This — NOT
 *                    the frontend `school` persona — is the source of truth for
 *                    which schools a user administers. `user_id` is a Better Auth
 *                    `neon_auth.user.id` but carries no FK to `neon_auth`,
 *                    matching the existing Aspira convention.
 *  - `enrollments`   `student_id <-> school_id` relationship plus the student's
 *                    class/section/academic year, so a student's school is a
 *                    persistent relationship rather than the free-text
 *                    `parent_child.school`/`class_name` labels (which are
 *                    preserved untouched for backward compatibility).
 *
 * Foreign keys are used AMONG these co-provisioned public tables (creation order
 * is controlled here) to keep the relationships referentially sound. The link
 * from an existing `parent_child` row to a canonical student is added as a
 * nullable `student_id` column on `public.parent_child` WITHOUT a foreign key —
 * matching the decoupled, no-FK style of the existing `child_user_id` column and
 * avoiding cross-helper provisioning-order coupling. It is nullable so every
 * existing parent_child row is preserved exactly and is simply not-yet-linked.
 */
let schoolFoundationReady: Promise<void> | null = null
export function ensureSchoolFoundationTables(): Promise<void> {
  if (!schoolFoundationReady) {
    schoolFoundationReady = (async () => {
      // Canonical student entity. `user_id` is the future (not-yet-implemented)
      // link to a real student's Better Auth account; nullable today.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.students (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid,
          name text,
          dob text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)

      // Minimal school record.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.schools (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)

      // Authoritative school-admin membership: which user administers which
      // school. FK to schools (co-provisioned above); no FK to neon_auth.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.school_admins (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
          user_id uuid NOT NULL,
          role text NOT NULL DEFAULT 'admin',
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // One membership row per (school, user) -> granting admin is idempotent.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS school_admins_unique
        ON public.school_admins (school_id, user_id)
      `)
      // Covers "which schools does this user administer" authorization lookups.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS school_admins_user
        ON public.school_admins (user_id)
      `)

      // Student <-> school enrollment, plus class/section/academic year. FKs to
      // the co-provisioned students and schools tables.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.enrollments (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
          school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
          class_name text,
          section text,
          academic_year text,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      // At most one enrollment per student per school per academic year.
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_school_year
        ON public.enrollments (student_id, school_id, academic_year)
      `)
      // Covers "students enrolled in this school" (school-admin authorization)
      // and "this student's enrollments" (parent/student resolution).
      await pool.query(`
        CREATE INDEX IF NOT EXISTS enrollments_school
        ON public.enrollments (school_id)
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS enrollments_student
        ON public.enrollments (student_id)
      `)

      // Link an existing parent_child roster row to a canonical student. The
      // parent_child table must exist first — it is owned by its own helper.
      // Additive, nullable, no FK (matches the existing child_user_id style):
      // every existing parent_child row is preserved and simply not-yet-linked.
      await ensureParentChildTable()
      await pool.query(`
        ALTER TABLE public.parent_child ADD COLUMN IF NOT EXISTS student_id uuid
      `)
      // Covers "which parent_child rows point at this canonical student".
      await pool.query(`
        CREATE INDEX IF NOT EXISTS parent_child_student
        ON public.parent_child (student_id)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      schoolFoundationReady = null
      throw error
    })
  }
  return schoolFoundationReady
}

/**
 * Lazily provisions the `public.report_cards` table (and its supporting
 * indexes) using the shared pool, following the exact same idempotent
 * (`IF NOT EXISTS`), memoized, schema-qualified pattern as the helpers above.
 *
 * This is THE single, shared report-card store — there is deliberately no
 * per-role copy (no parent_report_cards / student_report_cards /
 * school_report_cards). Each row binds a canonical `student_id` + `school_id`
 * to an academic year + class (+ section), so the same row resolves for a
 * parent (via `parent_child.student_id`), a school admin (via
 * `school_admins -> enrollments -> student`), and eventually a student.
 *
 * The uploaded file lives in Vercel Blob; only its metadata is stored here
 * (`file_url`, `file_pathname`, `file_type`, `original_filename`) — the file
 * bytes are never put in the database. Foreign keys reference the
 * co-provisioned foundation tables (`students`, `schools`), so this depends on
 * `ensureSchoolFoundationTables` having created them first. `created_by`/
 * `updated_by` are authenticated Better Auth user ids and carry no FK to
 * `neon_auth`, matching the existing Aspira convention.
 */
let reportCardsReady: Promise<void> | null = null
export function ensureReportCardsTable(): Promise<void> {
  if (!reportCardsReady) {
    reportCardsReady = (async () => {
      // The canonical students/schools tables must exist first — FKs below
      // reference them. `parent_child` must exist too, because a report may now
      // belong to an unlinked parent child (parent_child_id FK below).
      await ensureSchoolFoundationTables()
      await ensureParentChildTable()

      // Base table (fresh installs). student_id/school_id are NULLABLE so a
      // report can instead belong to an unlinked parent child via
      // parent_child_id. The owner CHECK guarantees at least one owner exists.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.report_cards (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
          school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
          parent_child_id uuid REFERENCES public.parent_child(id) ON DELETE CASCADE,
          academic_year text NOT NULL,
          class_name text NOT NULL,
          section text,
          title text NOT NULL,
          file_url text NOT NULL,
          file_pathname text,
          file_type text NOT NULL,
          original_filename text,
          created_by uuid NOT NULL,
          updated_by uuid,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT report_cards_owner_present
            CHECK (student_id IS NOT NULL OR parent_child_id IS NOT NULL)
        )
      `)

      // --- Backward-compatible migration for already-provisioned tables ------
      // Add the parent-owned column if the table predates this feature.
      await pool.query(`
        ALTER TABLE public.report_cards
        ADD COLUMN IF NOT EXISTS parent_child_id uuid
        REFERENCES public.parent_child(id) ON DELETE CASCADE
      `)
      // Relax the original NOT NULL constraints so a parent-owned report can
      // leave student_id/school_id NULL. Existing linked rows are untouched.
      await pool.query(`ALTER TABLE public.report_cards ALTER COLUMN student_id DROP NOT NULL`)
      await pool.query(`ALTER TABLE public.report_cards ALTER COLUMN school_id DROP NOT NULL`)
      // Enforce "at least one owner" on existing tables too (idempotent).
      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'report_cards_owner_present'
          ) THEN
            ALTER TABLE public.report_cards
            ADD CONSTRAINT report_cards_owner_present
            CHECK (student_id IS NOT NULL OR parent_child_id IS NOT NULL);
          END IF;
        END $$;
      `)

      // Covers the parent/school "report cards for this student, filtered by
      // school + academic year + class" listing — the primary hot path.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS report_cards_student_scope
        ON public.report_cards (student_id, school_id, academic_year, class_name)
      `)
      // Covers school-admin "all report cards for this school" lookups.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS report_cards_school
        ON public.report_cards (school_id)
      `)
      // Covers the parent-owned "report cards for this unlinked child" listing.
      await pool.query(`
        CREATE INDEX IF NOT EXISTS report_cards_parent_child
        ON public.report_cards (parent_child_id, academic_year, class_name)
      `)
    })().catch((error) => {
      // Reset so a transient failure can be retried on the next call.
      reportCardsReady = null
      throw error
    })
  }
  return reportCardsReady
}
