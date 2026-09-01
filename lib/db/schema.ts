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
