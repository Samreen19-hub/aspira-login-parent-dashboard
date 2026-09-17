'use server'

import { and, asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db, ensureParentChildTable } from '@/lib/db'
import { parentChild } from '@/lib/db/schema'
import type { Child } from '@/lib/parent-data'

/**
 * Real DB-backed My Children system (Neon + Better Auth).
 *
 * The `public.parent_child` table is the single source of truth for a parent's
 * children. Every query/mutation derives the acting parent's identity from the
 * Better Auth session (never from a browser-supplied id) and is scoped to that
 * parent, so a parent can only ever list/create/edit/delete their OWN children.
 *
 * Only account-less children are supported here — student invitation/linking is
 * intentionally out of scope and NOT implemented.
 */

const CHILDREN_PATHS = ['/parent/children', '/parent']

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function revalidateChildren() {
  for (const path of CHILDREN_PATHS) revalidatePath(path)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(value: string): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Input accepted by add/update — the editable child fields (never an id/owner). */
export type ChildInput = {
  name: string
  className: string
  school: string
  dob?: string
  relationship?: string
  avatar?: string
}

type ChildRow = typeof parentChild.$inferSelect

/**
 * Project a DB row into the existing client `Child` shape so every consumer
 * (My Children, sidebar, timetable selector, child feed) keeps working. The DB
 * `id` (uuid) becomes `Child.id`, which is what the UI uses for feed/timetable
 * links. `online` is decorative and always shown for a listed child, matching
 * the previous sample data.
 */
function toChild(row: ChildRow): Child {
  return {
    id: row.id,
    name: row.name,
    className: row.className ?? '',
    school: row.school ?? '',
    avatar: row.avatar || '/placeholder.svg',
    online: true,
    dob: row.dob ?? undefined,
    relationship: row.relationship ?? undefined,
  }
}

/** The signed-in parent's children, oldest first. Source of truth for the UI. */
export async function listChildren(): Promise<Child[]> {
  const meId = await getUserId()
  await ensureParentChildTable()

  const rows = await db
    .select()
    .from(parentChild)
    .where(eq(parentChild.parentUserId, meId))
    .orderBy(asc(parentChild.createdAt))

  return rows.map(toChild)
}

/**
 * Resolve a single child by id, scoped to the signed-in parent. Returns null for
 * an unknown/non-uuid id or a child owned by another parent — so one parent can
 * never read another parent's child (used by the child feed page).
 */
export async function getParentChild(childId: string): Promise<Child | null> {
  const meId = await getUserId()
  if (!isUuid(childId)) return null
  await ensureParentChildTable()

  const [row] = await db
    .select()
    .from(parentChild)
    .where(and(eq(parentChild.id, childId), eq(parentChild.parentUserId, meId)))
    .limit(1)

  return row ? toChild(row) : null
}

/** Create a child for the signed-in parent. Ownership is set from the session. */
export async function addChild(input: ChildInput): Promise<Child> {
  const meId = await getUserId()
  const name = input.name?.trim()
  const className = input.className?.trim()
  const school = input.school?.trim()
  if (!name || !className || !school) {
    throw new Error('Name, class and school are required.')
  }

  await ensureParentChildTable()
  const [row] = await db
    .insert(parentChild)
    .values({
      parentUserId: meId,
      status: 'unlinked',
      name,
      className,
      school,
      dob: input.dob?.trim() || null,
      relationship: input.relationship?.trim() || 'Child',
      avatar: input.avatar?.trim() || '/placeholder.svg',
    })
    .returning()

  revalidateChildren()
  return toChild(row)
}

/**
 * Update an existing child of the signed-in parent. The `parentUserId` filter
 * makes it impossible to edit a child owned by another parent (returns null).
 */
export async function updateChild(
  childId: string,
  updates: Partial<ChildInput>,
): Promise<Child | null> {
  const meId = await getUserId()
  if (!isUuid(childId)) throw new Error('A valid child is required.')

  await ensureParentChildTable()
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (updates.name !== undefined) patch.name = updates.name.trim()
  if (updates.className !== undefined) patch.className = updates.className.trim()
  if (updates.school !== undefined) patch.school = updates.school.trim()
  if (updates.dob !== undefined) patch.dob = updates.dob.trim() || null
  if (updates.relationship !== undefined) {
    patch.relationship = updates.relationship.trim() || 'Child'
  }
  if (updates.avatar !== undefined) {
    patch.avatar = updates.avatar.trim() || '/placeholder.svg'
  }

  const [row] = await db
    .update(parentChild)
    .set(patch)
    .where(and(eq(parentChild.id, childId), eq(parentChild.parentUserId, meId)))
    .returning()

  revalidateChildren()
  return row ? toChild(row) : null
}

/**
 * Delete a child of the signed-in parent. The `parentUserId` filter makes it
 * impossible to delete a child owned by another parent.
 */
export async function deleteChild(childId: string): Promise<void> {
  const meId = await getUserId()
  if (!isUuid(childId)) throw new Error('A valid child is required.')

  await ensureParentChildTable()
  await db
    .delete(parentChild)
    .where(and(eq(parentChild.id, childId), eq(parentChild.parentUserId, meId)))

  revalidateChildren()
}
