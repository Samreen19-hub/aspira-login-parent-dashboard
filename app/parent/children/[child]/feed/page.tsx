import { notFound } from "next/navigation"
import { PageShell } from "@/components/parent/page-shell"
import { HomeFeed } from "@/components/parent/home-feed"
import { getParentChild } from "@/app/actions/children"

export default async function ChildFeedPage({ params }: { params: Promise<{ child: string }> }) {
  const { child: childId } = await params
  // Resolve from the DB-backed roster, scoped to the signed-in parent, so this
  // works for the seeded Aarav/Saanvi and any newly added account-less child —
  // and 404s for an unknown child or one owned by another parent.
  const child = await getParentChild(childId)
  if (!child) notFound()
  // The Home Feed filters posts by a loose text token. Use the child's first
  // name so the existing seed posts (which mention e.g. "Aarav") keep surfacing,
  // preserving the current feed behavior without changing the feed architecture.
  const feedToken = child.name.trim().split(/\s+/)[0]?.toLowerCase() || child.id
  return (
    <PageShell title={`${child.name}'s Feed`} description={`${child.className} · ${child.school}`}>
      <HomeFeed childId={feedToken} />
    </PageShell>
  )
}
