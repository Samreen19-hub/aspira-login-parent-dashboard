import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Descriptive mirror of the LIVE database (already provisioned in Neon).
 * DDL is NOT managed here — these definitions exist so Drizzle can query the
 * existing tables in a type-safe way. Column names/casing match the live schema
 * exactly (Better Auth uses camelCase columns).
 */

// ---------------------------------------------------------------------------
// Better Auth tables (schema: neon_auth). Managed by Better Auth at runtime.
// ---------------------------------------------------------------------------
const neonAuth = pgSchema('neon_auth')

export const user = neonAuth.table('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('emailVerified').notNull(),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires', { withTimezone: true }),
})

// ---------------------------------------------------------------------------
// App tables (schema: public).
// ---------------------------------------------------------------------------
export const profiles = pgTable('profiles', {
  userId: uuid('user_id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  persona: text('persona').notNull().default('parent'),
  phone: text('phone'),
  avatar: text('avatar'),
  headline: text('headline'),
  location: text('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const connections = pgTable('connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  requesterId: uuid('requester_id').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * One-way follow relationships (schema: public). Distinct from `connections`:
 * `follower_id` follows `following_id` immediately, no acceptance required, and
 * a follow never implies a connection (or vice-versa). The row is directional,
 * so a mutual follow is two rows. Uniqueness of (follower_id, following_id) is
 * enforced by the `follows_unique_pair` index created in `ensureFollowsTable`.
 */
export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: uuid('follower_id').notNull(),
  followingId: uuid('following_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Direct messages (schema: public). A "conversation" is the unordered pair of
 * the two users — no separate conversation table is needed for one-to-one chat,
 * mirroring how `connections` models a pairwise relationship. `read_at` is null
 * while the recipient has not read the message, which drives unread counts.
 * Provisioned lazily by `ensureMessagesTable` (see `lib/db/index.ts`).
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderId: uuid('sender_id').notNull(),
  // Nullable now that group messages exist: a group message targets a
  // `conversation_id` and has no single recipient. Direct messages still set
  // `recipient_id` exactly as before, so their behavior is unchanged.
  recipientId: uuid('recipient_id'),
  // Null for direct messages (the pair itself is the conversation); set for
  // group messages to the owning `public.conversations` row.
  conversationId: uuid('conversation_id'),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
})

/**
 * Group (and, in principle, any multi-party) conversations (schema: public).
 * Direct one-to-one chat does NOT use this table — it stays modeled purely by
 * the sender/recipient pair on `public.messages`. A row here exists only for
 * `type = 'group'` conversations created via the group UI. Provisioned lazily
 * by `ensureGroupTables` (see `lib/db/index.ts`).
 */
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull().default('group'),
  name: text('name'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Membership of a `public.conversations` group. `last_read_at` holds the
 * per-user read watermark for the group: unread group messages are those
 * created after this timestamp and not sent by the user. This keeps group read
 * state user-specific without touching the direct-message `read_at` column.
 * Uniqueness of (conversation_id, user_id) is enforced by the
 * `conversation_members_unique` index created in `ensureGroupTables`.
 */
export const conversationMembers = pgTable('conversation_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  userId: uuid('user_id').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
})

/**
 * Per-user notifications (schema: public). One row = one thing that happened
 * that `recipient_id` should see (a message, group message, connection request,
 * connection acceptance, or follow). `actor_id` is who caused it (nullable for
 * system-originated notifications) and is ALWAYS the authenticated session user
 * at creation time — never trusted from the browser. `entity_id` points at the
 * source row (message id, connection id, follow id) so the UI can deep-link.
 * `read_at` is null until the recipient reads it, which drives the unread badge.
 *
 * Following the existing Aspira convention this carries no foreign keys to
 * `neon_auth.user`; it is provisioned lazily by `ensureNotificationsTable`
 * (see `lib/db/index.ts`). This is the SINGLE notifications table — the static
 * School Updates feature is intentionally separate and untouched.
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id').notNull(),
  actorId: uuid('actor_id'),
  type: text('type').notNull(),
  entityId: uuid('entity_id'),
  body: text('body'),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * User posts (schema: public). ONE row per post; every post type shares this
 * table with `type` acting as a free-text discriminator (`text | photo |
 * achievement | poll | event`, and any future kind — no schema change needed).
 * `author_id` is ALWAYS the authenticated session user at creation time, never
 * trusted from the browser. `scope` mirrors the existing client convention:
 * null = main Home feed; otherwise the group/community slug the post belongs to.
 * Type-specific structure (achievement/photo/poll/event details) lives in the
 * `payload` JSONB so no per-type columns or tables are required; live like /
 * comment / vote / rsvp counts are derived from the tables below, never stored
 * in the payload. Following the existing Aspira convention this carries no
 * foreign keys to `neon_auth.user`; it is provisioned lazily by
 * `ensurePostsTables` (see `lib/db/index.ts`).
 */
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull(),
  type: text('type').notNull(),
  body: text('body'),
  scope: text('scope'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Likes on a post (schema: public). One row = one user liking one post. The
 * unique `(post_id, user_id)` index (created in `ensurePostsTables`) makes a
 * like idempotent, so the like count is simply `COUNT(*)` for a post and a
 * toggle is an insert-or-delete. `user_id` is the authenticated session user.
 */
export const postLikes = pgTable('post_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Comments on a post (schema: public). `author_id` is the authenticated session
 * user; the display name/avatar are resolved by joining `profiles`/`user` at
 * read time (never stored here), matching the notifications pattern.
 */
export const postComments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  authorId: uuid('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Poll votes (schema: public). One vote per user per poll enforced by the
 * unique `(post_id, user_id)` index, so changing a vote is an upsert. The vote
 * is index-based (`option_index` aligns to the poll's `options[]` array in the
 * post payload), matching the existing client poll shape. Tallies are computed
 * with `GROUP BY option_index` and never stored back into the payload.
 */
export const pollVotes = pgTable('poll_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
  optionIndex: integer('option_index').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Event RSVPs (schema: public). One RSVP per user per event post enforced by
 * the unique `(post_id, user_id)` index, so setting/updating an RSVP is an
 * upsert. `status` is free-text (`going | interested | not_going` today) to
 * stay flexible. This is the server-backed successor to the current
 * localStorage `aspira-parent-event-rsvp`, but nothing is migrated yet.
 */
export const eventRsvps = pgTable('event_rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Groups/Communities membership & following (schema: public). ONE row = one user
 * belonging to one space (identified by its static `slug`). This single table
 * models group membership, community following, AND admin ownership via `role`
 * (`member | admin`), so no separate follower or admin table is needed. It is
 * ONLY for the Groups/Communities social pages — it is completely unrelated to
 * the group-chat `conversation_members` table, which is left untouched.
 *
 * `user_id` is ALWAYS the authenticated session user at write time, never
 * trusted from the browser. Following the existing Aspira convention this
 * carries no foreign keys to `neon_auth.user`; it is provisioned lazily by
 * `ensureSpaceMembersTable` (see `lib/db/index.ts`). Uniqueness of
 * `(slug, user_id)` is enforced by the `space_members_unique` index so a
 * join/follow is idempotent and role changes are a plain update.
 */
export const spaceMembers = pgTable('space_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Groups/Communities space DEFINITIONS (schema: public). ONE row = one space
 * (a group or a community), identified by its unique `slug`. This is the source
 * of truth for a space's EXISTENCE and metadata (title/category/description/
 * privacy), replacing the previous hardcoded `SOCIAL_SPACES` + localStorage
 * arrangement so a created space survives refresh, logout/login, and other
 * devices. `kind` is `group | community` (singular, DB-canonical); the UI maps
 * it to its plural `groups | communities` form.
 *
 * Membership/following/admin ownership stays in `public.space_members` and
 * invitations in `public.space_invitations` — this table never duplicates them;
 * it only records that the space itself exists. `created_by` is the
 * authenticated Better Auth session user at creation time (never trusted from
 * the browser) and is NULL for the seeded built-in spaces (system-owned).
 * Following the existing Aspira convention this carries no foreign keys to
 * `neon_auth.user`; it is provisioned lazily by `ensureSpacesTable`
 * (see `lib/db/index.ts`). Uniqueness of `slug` is enforced by the
 * `spaces_slug_unique` index so seeding/creating is idempotent.
 */
export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  category: text('category'),
  description: text('description'),
  privacy: text('privacy').notNull().default('Public'),
  /**
   * GROUP-only access control: who may join a group. One of
   * `anyone | connections | invite`. Communities ignore this (they are always
   * public and use Follow), so their value is irrelevant and defaults to
   * `anyone`. Added lazily by `ensureSpacesTable` with a backward-compatible
   * DEFAULT so every existing space (built-in or user-created) keeps the prior
   * unrestricted "anyone can join" semantics — no existing member is affected.
   */
  joinPolicy: text('join_policy').notNull().default('anyone'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Real pending invitations to a Groups/Communities space (schema: public). ONE
 * row = one user (`inviter_id`) invited another user (`invitee_id`) into a space
 * (`space_slug`). This sits ALONGSIDE `public.space_members` and never replaces
 * it: an invitation is NOT membership — a `space_members` row is created only if
 * and when the recipient accepts. It is completely unrelated to the group-chat
 * invitation flow (`conversations`/`conversation_members`), which is untouched.
 *
 * `inviter_id` is ALWAYS the authenticated session user at write time, never
 * trusted from the browser. `status` is `pending | accepted | declined |
 * cancelled`; `responded_at` is set when the recipient accepts/declines (or the
 * inviter cancels). Following the existing Aspira convention this carries no
 * foreign keys to `neon_auth.user`; it is provisioned lazily by
 * `ensureSpaceInvitationsTable` (see `lib/db/index.ts`). The partial unique
 * index `space_invitations_pending_unique` allows only one `pending` row per
 * `(space_slug, invitee_id)`, so duplicate active invitations are impossible.
 */
export const spaceInvitations = pgTable('space_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceSlug: text('space_slug').notNull(),
  inviterId: uuid('inviter_id').notNull(),
  inviteeId: uuid('invitee_id').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
})

/**
 * Per-user hidden posts (schema: public). One row = one user hiding one post
 * from their OWN feed only. This never deletes or mutates the original post or
 * its interactions — it is a viewer-scoped filter, so a post hidden by one user
 * stays fully visible to everyone else. `user_id` is the authenticated session
 * user. The unique `(post_id, user_id)` index (created in `ensurePostHidesTable`)
 * makes hiding idempotent. Following the existing Aspira convention this carries
 * no foreign keys to `neon_auth.user`; provisioned lazily by
 * `ensurePostHidesTable` (see `lib/db/index.ts`).
 */
export const postHides = pgTable('post_hides', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull(),
  userId: uuid('user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Parent-child roster (schema: public). ONE row = one child belonging to one
 * parent. This is the single source of truth for a parent's children, replacing
 * the previous localStorage arrangement. `parent_user_id` is ALWAYS the
 * authenticated session user at write time, never trusted from the browser.
 *
 * Only account-less children are supported today: `child_user_id` stays nullable
 * (reserved for a future real-student linking feature — NOT implemented here)
 * and `status` defaults to `unlinked`. `class_name` maps to the UI's `className`
 * field. There is intentionally NO progress/performance column. Following the
 * existing Aspira convention this carries no foreign keys to `neon_auth.user`;
 * it is provisioned lazily by `ensureParentChildTable` (see `lib/db/index.ts`).
 */
export const parentChild = pgTable('parent_child', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentUserId: uuid('parent_user_id').notNull(),
  childUserId: uuid('child_user_id'),
  /**
   * Optional link from this parent roster row to the SHARED canonical student
   * (`public.students.id`). Nullable and without a foreign key — matching the
   * decoupled `child_user_id` style — so every existing parent_child row is
   * preserved and simply not-yet-linked until associated. Added lazily by
   * `ensureSchoolFoundationTables` (see `lib/db/index.ts`).
   */
  studentId: uuid('student_id'),
  status: text('status').notNull().default('unlinked'),
  name: text('name').notNull(),
  className: text('class_name'),
  school: text('school'),
  relationship: text('relationship'),
  dob: text('dob'),
  avatar: text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Per-parent one-time seed marker (schema: public). A row means the built-in
 * demo children have already been seeded for this parent, so they are created at
 * most once and never reappear after deletion. Stores no child data. Provisioned
 * lazily by `ensureParentChildTable` (see `lib/db/index.ts`).
 */
export const parentChildSeeds = pgTable('parent_child_seeds', {
  parentUserId: uuid('parent_user_id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Canonical student entity (schema: public). Part of the SHARED school
 * foundation provisioned by `ensureSchoolFoundationTables` (see
 * `lib/db/index.ts`). `user_id` is the future (not-yet-implemented) link to a
 * real student's Better Auth account and stays nullable, mirroring the
 * decoupled `parent_child.child_user_id` convention. No foreign key to
 * `neon_auth`.
 */
export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  name: text('name'),
  dob: text('dob'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Minimal school record (schema: public). Part of the SHARED school foundation
 * provisioned by `ensureSchoolFoundationTables`.
 */
export const schools = pgTable('schools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Authoritative school-admin membership (schema: public): which user
 * administers which school. This — NOT the frontend `school` persona — is the
 * source of truth for school-admin authorization. `user_id` is a Better Auth
 * `neon_auth.user.id` but carries no FK to `neon_auth`, matching the existing
 * Aspira convention. Provisioned by `ensureSchoolFoundationTables`.
 */
export const schoolAdmins = pgTable('school_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull(),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Student <-> school enrollment plus the student's class/section/academic year
 * (schema: public). A student's school is a persistent relationship here rather
 * than the free-text `parent_child.school`/`class_name` labels (which are
 * preserved untouched). The canonical source for the parent Report Card page's
 * Year and Class dropdowns. Provisioned by `ensureSchoolFoundationTables`.
 */
export const enrollments = pgTable('enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull(),
  schoolId: uuid('school_id').notNull(),
  className: text('class_name'),
  section: text('section'),
  academicYear: text('academic_year'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Report cards (schema: public). THE single, shared source of truth for a
 * report card — there is intentionally no parent/student/school-specific copy.
 * Each row is bound to the canonical `student_id` + `school_id` and the
 * academic year + class (+ section where the enrollment has one), so the SAME
 * row is resolvable by a parent (via `parent_child.student_id`), by a school
 * admin (via `school_admins -> enrollments -> student`), and eventually by the
 * student.
 *
 * The uploaded file itself lives in Vercel Blob (private store); only its
 * metadata lives here: `file_url` (the blob URL — not publicly reachable for a
 * private store, served through an authenticated route), `file_pathname` (the
 * blob pathname, used to serve and to delete/clean up the blob), `file_type`
 * (MIME) and `original_filename`. `created_by`/`updated_by` are the
 * authenticated Better Auth user ids (parent OR school admin), never trusted
 * from the browser. Provisioned lazily by `ensureReportCardsTable`
 * (see `lib/db/index.ts`).
 */
export const reportCards = pgTable('report_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * Canonical-student owner. NULLABLE now that a report may instead belong to
   * an unlinked parent child (see `parentChildId`). A DB CHECK constraint
   * (`report_cards_owner_present`) guarantees at least one owner is set.
   */
  studentId: uuid('student_id'),
  schoolId: uuid('school_id'),
  /**
   * Parent-owned owner: set when the report was uploaded by a parent for a
   * child not yet linked to a canonical student (`parent_child.student_id IS
   * NULL`). Mutually exclusive with `studentId` in practice — a future
   * school-admin merge promotes the row IN PLACE by setting `studentId`/
   * `schoolId`/`section` and clearing `parentChildId`, keeping the same `id`.
   */
  parentChildId: uuid('parent_child_id'),
  academicYear: text('academic_year').notNull(),
  className: text('class_name').notNull(),
  section: text('section'),
  title: text('title').notNull(),
  fileUrl: text('file_url').notNull(),
  filePathname: text('file_pathname'),
  fileType: text('file_type').notNull(),
  originalFilename: text('original_filename'),
  createdBy: uuid('created_by').notNull(),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
