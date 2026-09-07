import {
  boolean,
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
