import { notFound } from "next/navigation"
import { PageShell } from "@/components/parent/page-shell"
import { HomeFeed } from "@/components/parent/home-feed"
import { CHILDREN } from "@/lib/parent-data"

export default async function ChildFeedPage({ params }: { params: Promise<{ child: string }> }) {
  const { child: childId } = await params
  const child = CHILDREN.find((item) => item.id === childId)
  if (!child) notFound()
  return <PageShell title={`${child.name}'s Feed`} description={`${child.className} · ${child.school}`}><HomeFeed childId={child.id} /></PageShell>
}
