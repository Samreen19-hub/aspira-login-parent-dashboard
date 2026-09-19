'use server'

import { and, desc, eq } from 'drizzle-orm'
import { del, put } from '@vercel/blob'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db, ensureReportCardsTable } from '@/lib/db'
import { enrollments, parentChild, reportCards } from '@/lib/db/schema'

/**
 * Real DB + Vercel Blob backed Report Cards (the SINGLE, shared source of
 * truth — no per-role copies).
 *
 * Every operation derives the acting user's identity from the Better Auth
 * session and authorizes through the canonical relationship
 *
 *   session.user.id -> parent_child.parentUserId -> parent_child.student_id
 *                   -> report_cards.student_id
 *
 * A browser-supplied studentId / schoolId / reportId is NEVER trusted for
 * authorization: a parent can only ever see or manage report cards belonging to
 * a student linked to one of their OWN children. The same `report_cards` row is
 * (by design) resolvable later by a school admin via
 * `school_admins -> enrollments -> student`, so nothing here makes a report
 * parent-owned in a way that would block school-admin management.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

const ACCEPTED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
])
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user.id
}

function revalidateChild(childId: string) {
  revalidatePath(`/parent/children/${childId}/report-card`)
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type EnrollmentOption = {
  academicYear: string
  className: string
  section: string | null
  schoolId: string
}

export type ReportCard = {
  id: string
  academicYear: string
  className: string
  section: string | null
  title: string
  fileType: string
  originalFilename: string | null
  createdAt: string
  updatedAt: string
  canManage: boolean
}

export type ReportCardContext = {
  childId: string
  childName: string
  linked: boolean
  /** Distinct enrollment options for the linked student (drives the dropdowns). */
  options: EnrollmentOption[]
}

/* -------------------------------------------------------------------------- */
/*  Authorization helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the canonical student id for a parent's child, scoped to the signed-in
 * parent. Returns null when the child is unknown, owned by another parent, or
 * not yet linked to a canonical student (`student_id IS NULL`). This is the ONLY
 * gateway from a browser-supplied childId to a trusted studentId.
 */
async function resolveParentStudentId(
  parentUserId: string,
  childId: string,
): Promise<{ childName: string; studentId: string | null } | null> {
  if (!isUuid(childId)) return null
  const [row] = await db
    .select({ name: parentChild.name, studentId: parentChild.studentId })
    .from(parentChild)
    .where(
      and(eq(parentChild.id, childId), eq(parentChild.parentUserId, parentUserId)),
    )
    .limit(1)
  if (!row) return null
  return { childName: row.name, studentId: row.studentId ?? null }
}

/**
 * Verify the signed-in parent may manage a specific report card (by id) and
 * return the row. Authorization is by OWNERSHIP of the underlying student, not
 * by the supplied reportId — a parent can only touch a report whose `student_id`
 * is linked to one of THEIR children. Returns null otherwise.
 */
async function resolveManageableReport(parentUserId: string, reportId: string) {
  if (!isUuid(reportId)) return null
  await ensureReportCardsTable()

  const [report] = await db
    .select()
    .from(reportCards)
    .where(eq(reportCards.id, reportId))
    .limit(1)
  if (!report) return null

  // The report's student must be linked to one of this parent's children.
  const [link] = await db
    .select({ id: parentChild.id })
    .from(parentChild)
    .where(
      and(
        eq(parentChild.parentUserId, parentUserId),
        eq(parentChild.studentId, report.studentId),
      ),
    )
    .limit(1)
  if (!link) return null

  return report
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Context for the parent Report Card page: whether the child is linked to a
 * canonical student and, if so, the enrollment-derived Year/Class options.
 */
export async function getReportCardContext(
  childId: string,
): Promise<ReportCardContext | null> {
  const meId = await getUserId()
  await ensureReportCardsTable()

  const resolved = await resolveParentStudentId(meId, childId)
  if (!resolved) return null

  if (!resolved.studentId) {
    return { childId, childName: resolved.childName, linked: false, options: [] }
  }

  const rows = await db
    .select({
      academicYear: enrollments.academicYear,
      className: enrollments.className,
      section: enrollments.section,
      schoolId: enrollments.schoolId,
    })
    .from(enrollments)
    .where(eq(enrollments.studentId, resolved.studentId))

  const options: EnrollmentOption[] = rows
    .filter((r) => r.academicYear && r.className)
    .map((r) => ({
      academicYear: r.academicYear as string,
      className: r.className as string,
      section: r.section ?? null,
      schoolId: r.schoolId,
    }))

  return { childId, childName: resolved.childName, linked: true, options }
}

/**
 * Report cards for a parent's child, filtered by the selected academic year and
 * class. Resolves through the parent's link to the canonical student and only
 * ever returns rows for the matching enrollment's school — never trusting a
 * client studentId/schoolId.
 */
export async function listReportCards(
  childId: string,
  filter: { academicYear: string; className: string },
): Promise<ReportCard[]> {
  const meId = await getUserId()
  await ensureReportCardsTable()

  const resolved = await resolveParentStudentId(meId, childId)
  if (!resolved?.studentId) return []
  if (!filter.academicYear || !filter.className) return []

  // Confirm the (year, class) corresponds to a real enrollment of THIS student,
  // and derive the authoritative school_id from that enrollment.
  const [enr] = await db
    .select({ schoolId: enrollments.schoolId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, resolved.studentId),
        eq(enrollments.academicYear, filter.academicYear),
        eq(enrollments.className, filter.className),
      ),
    )
    .limit(1)
  if (!enr) return []

  const rows = await db
    .select()
    .from(reportCards)
    .where(
      and(
        eq(reportCards.studentId, resolved.studentId),
        eq(reportCards.schoolId, enr.schoolId),
        eq(reportCards.academicYear, filter.academicYear),
        eq(reportCards.className, filter.className),
      ),
    )
    .orderBy(desc(reportCards.createdAt))

  return rows.map((r) => ({
    id: r.id,
    academicYear: r.academicYear,
    className: r.className,
    section: r.section ?? null,
    title: r.title,
    fileType: r.fileType,
    originalFilename: r.originalFilename ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    canManage: true,
  }))
}

/* -------------------------------------------------------------------------- */
/*  Mutations                                                                 */
/* -------------------------------------------------------------------------- */

function validateFile(file: File): void {
  if (!file || file.size === 0) throw new Error('A report file is required.')
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File is too large (max 15MB).')
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    throw new Error('Only PNG, JPG/JPEG and PDF files are accepted.')
  }
}

function sanitizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'report'
  )
}

/**
 * Create a report card for a parent's child. The file is stored in Vercel Blob
 * (private); only its metadata + blob location are persisted in `report_cards`.
 * `school_id`/`section` are derived server-side from the student's matching
 * enrollment — the client only supplies the selected year + class.
 */
export async function addReportCard(formData: FormData): Promise<void> {
  const meId = await getUserId()
  await ensureReportCardsTable()

  const childId = String(formData.get('childId') ?? '')
  const academicYear = String(formData.get('academicYear') ?? '').trim()
  const className = String(formData.get('className') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const file = formData.get('file') as File | null

  if (!academicYear || !className) {
    throw new Error('Academic year and class are required.')
  }
  if (!title) throw new Error('A report title is required.')
  if (!file) throw new Error('A report file is required.')
  validateFile(file)

  const resolved = await resolveParentStudentId(meId, childId)
  if (!resolved) throw new Error('Not authorized for this child.')
  if (!resolved.studentId) {
    throw new Error('This child is not linked to a student yet.')
  }

  // Derive the authoritative school_id + section from the student's enrollment.
  const [enr] = await db
    .select({ schoolId: enrollments.schoolId, section: enrollments.section })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, resolved.studentId),
        eq(enrollments.academicYear, academicYear),
        eq(enrollments.className, className),
      ),
    )
    .limit(1)
  if (!enr) throw new Error('No matching class/year enrollment for this student.')

  const pathname = `report-cards/${resolved.studentId}/${crypto.randomUUID()}-${sanitizeName(
    file.name,
  )}`
  const blob = await put(pathname, file, {
    access: 'private',
    contentType: file.type,
  })

  await db.insert(reportCards).values({
    studentId: resolved.studentId,
    schoolId: enr.schoolId,
    academicYear,
    className,
    section: enr.section ?? null,
    title,
    fileUrl: blob.url,
    filePathname: blob.pathname,
    fileType: file.type,
    originalFilename: file.name,
    createdBy: meId,
    updatedBy: meId,
  })

  revalidateChild(childId)
}

/**
 * Update an existing report card the parent is authorized to manage. Supports
 * changing the title and optionally REPLACING the uploaded file. When a new file
 * replaces the old one, the previous blob is deleted so no orphan is left. This
 * mutates the SAME row (never creates a duplicate).
 */
export async function updateReportCard(formData: FormData): Promise<void> {
  const meId = await getUserId()

  const reportId = String(formData.get('reportId') ?? '')
  const childId = String(formData.get('childId') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const file = formData.get('file') as File | null

  const report = await resolveManageableReport(meId, reportId)
  if (!report) throw new Error('Report not found or not authorized.')

  const patch: Record<string, unknown> = { updatedAt: new Date(), updatedBy: meId }
  if (title) patch.title = title

  let oldPathnameToDelete: string | null = null
  if (file && file.size > 0) {
    validateFile(file)
    const pathname = `report-cards/${report.studentId}/${crypto.randomUUID()}-${sanitizeName(
      file.name,
    )}`
    const blob = await put(pathname, file, {
      access: 'private',
      contentType: file.type,
    })
    patch.fileUrl = blob.url
    patch.filePathname = blob.pathname
    patch.fileType = file.type
    patch.originalFilename = file.name
    oldPathnameToDelete = report.filePathname ?? report.fileUrl
  }

  await db.update(reportCards).set(patch).where(eq(reportCards.id, report.id))

  // Best-effort cleanup of the replaced blob (never block the update on it).
  if (oldPathnameToDelete) {
    try {
      await del(oldPathnameToDelete)
    } catch {
      // Orphan cleanup is non-critical; the DB row already points at the new file.
    }
  }

  if (childId) revalidateChild(childId)
}

/**
 * Delete a report card the parent is authorized to manage: removes the DB row
 * and the associated blob file. Authorization is by student ownership, so a
 * parent cannot delete another child's report by swapping the id.
 */
export async function deleteReportCard(
  reportId: string,
  childId?: string,
): Promise<void> {
  const meId = await getUserId()

  const report = await resolveManageableReport(meId, reportId)
  if (!report) throw new Error('Report not found or not authorized.')

  await db.delete(reportCards).where(eq(reportCards.id, report.id))

  const pathname = report.filePathname ?? report.fileUrl
  if (pathname) {
    try {
      await del(pathname)
    } catch {
      // Non-critical: the DB record (source of truth) is already gone.
    }
  }

  if (childId) revalidateChild(childId)
}
