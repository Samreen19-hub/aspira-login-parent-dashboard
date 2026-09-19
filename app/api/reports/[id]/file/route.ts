import { type NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db, ensureReportCardsTable } from '@/lib/db'
import { parentChild, reportCards, schoolAdmins } from '@/lib/db/schema'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Authenticated delivery of a PRIVATE report-card blob.
 *
 * The private store's `blob.url` is NOT publicly reachable — files are served
 * only through this route, and ONLY after verifying the signed-in user is
 * authorized for the specific report. Authorization is derived entirely
 * server-side from the report's canonical relationships, never from a
 * client-supplied studentId/schoolId:
 *
 *   parent      : session.user.id -> parent_child.student_id == report.student_id
 *   school admin : session.user.id -> school_admins.school_id == report.school_id
 *
 * The `?download=1` query switches the Content-Disposition to `attachment` so
 * the same endpoint powers both inline View and Download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = session.user.id

  await ensureReportCardsTable()

  const [report] = await db
    .select()
    .from(reportCards)
    .where(eq(reportCards.id, id))
    .limit(1)
  if (!report) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Parent authorization: the report's student is linked to one of my children.
  const [parentLink] = await db
    .select({ id: parentChild.id })
    .from(parentChild)
    .where(
      and(
        eq(parentChild.parentUserId, userId),
        eq(parentChild.studentId, report.studentId),
      ),
    )
    .limit(1)

  let authorized = Boolean(parentLink)

  // School-admin authorization (future-facing, same shared row): I administer
  // the school this report belongs to.
  if (!authorized) {
    const [adminLink] = await db
      .select({ id: schoolAdmins.id })
      .from(schoolAdmins)
      .where(
        and(
          eq(schoolAdmins.userId, userId),
          eq(schoolAdmins.schoolId, report.schoolId),
        ),
      )
      .limit(1)
    authorized = Boolean(adminLink)
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pathname = report.filePathname ?? report.fileUrl
  try {
    const result = await get(pathname, {
      access: 'private',
      ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
    })

    if (!result) {
      return new NextResponse('Not found', { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: result.blob.etag,
          'Cache-Control': 'private, no-cache',
        },
      })
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    const filename = (report.originalFilename ?? 'report-card').replace(/"/g, '')
    const disposition = `${download ? 'attachment' : 'inline'}; filename="${filename}"`

    return new NextResponse(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType || report.fileType,
        'Content-Disposition': disposition,
        ETag: result.blob.etag,
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Error serving report card file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
