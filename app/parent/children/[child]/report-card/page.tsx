import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { PageShell } from "@/components/parent/page-shell"
import { Card } from "@/components/ui/card"
import { getParentChild } from "@/app/actions/children"

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
 * There is no report-card data source yet (the School Admin/Student publishing
 * architecture is out of scope for now), so this always renders a clear empty
 * state. The layout is structured so a published report card can be dropped in
 * later without reworking the page.
 */
export default async function ChildReportCardPage({
  params,
}: {
  params: Promise<{ child: string }>
}) {
  const { child: childId } = await params
  const child = await getParentChild(childId)
  if (!child) notFound()

  return (
    <PageShell title={`${child.name}'s Report Card`} description={`${child.className} · ${child.school}`}>
      {/* Empty state — shown until the school publishes a report card. When the
          publishing architecture exists, render the real report card here in
          place of this card, keyed by the same verified `child`. */}
      <Card className="items-center gap-3 p-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <FileText className="size-7" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">No report card yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Your report card will appear here when your school posts it.
        </p>
      </Card>
    </PageShell>
  )
}
