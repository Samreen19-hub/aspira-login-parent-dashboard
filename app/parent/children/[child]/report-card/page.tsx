import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { PageShell } from "@/components/parent/page-shell"
import { ReportCardView } from "@/components/parent/report-card-view"
import { getParentChild } from "@/app/actions/children"
import { getReportCardContext } from "@/app/actions/report-cards"

/**
 * Child-specific Report Card page (real DB + Vercel Blob backed).
 *
 * Reachable only from My Children -> a child's "Report Card" action. Ownership
 * is verified server-side: `getParentChild` resolves the child from the DB
 * scoped to the Better Auth session parent and 404s for an unknown child or one
 * owned by another parent. `getReportCardContext` then resolves the child to its
 * canonical student (`parent_child.student_id`) and returns the enrollment-
 * derived Year/Class options — or an unlinked flag when the child has no
 * canonical student yet. No demo data is used anywhere in this flow.
 */
export default async function ChildReportCardPage({
  params,
}: {
  params: Promise<{ child: string }>
}) {
  const { child: childId } = await params
  const child = await getParentChild(childId)
  if (!child) notFound()

  const context = await getReportCardContext(childId)
  if (!context) notFound()

  return (
    <PageShell
      title={`${child.name}'s Report Card`}
      description={`${child.className} · ${child.school}`}
      icon={FileText}
    >
      <ReportCardView context={context} />
    </PageShell>
  )
}
