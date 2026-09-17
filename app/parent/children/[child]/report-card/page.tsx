import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { PageShell } from "@/components/parent/page-shell"
import { ReportCardView } from "@/components/parent/report-card-view"
import { getParentChild } from "@/app/actions/children"
import { getDemoReportCards } from "@/lib/demo-academics"

/**
 * Child-specific Report Card page.
 *
 * Reachable only from My Children → a child's "Report Card" action; it is
 * intentionally NOT in the sidebar or any global navigation. Ownership is
 * verified exactly like the child feed page: `getParentChild` resolves the
 * child from the DB scoped to the Better Auth session parent and returns null
 * for an unknown child or one owned by another parent, so this 404s instead of
 * exposing another parent's child.
 *
 * Report-card data is DEMO/UI-only (no report-card database, tables, or
 * migrations). `getDemoReportCards` matches by child name (the existing
 * "Mujtaba → Mariyam" demo scenario) and returns an empty list for everyone
 * else, so the client viewer shows the real empty state for ordinary parents.
 */
export default async function ChildReportCardPage({
  params,
}: {
  params: Promise<{ child: string }>
}) {
  const { child: childId } = await params
  const child = await getParentChild(childId)
  if (!child) notFound()

  const cards = getDemoReportCards(child.name)

  return (
    <PageShell
      title={`${child.name}'s Report Card`}
      description={`${child.className} · ${child.school}`}
      icon={FileText}
    >
      <ReportCardView
        child={{ name: child.name, className: child.className, school: child.school }}
        cards={cards}
      />
    </PageShell>
  )
}
