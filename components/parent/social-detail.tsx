"use client"

import Link from "next/link"
import { ArrowLeft, Bell, CalendarDays, Check, MessageCircle, Settings, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageShell } from "@/components/parent/page-shell"
import { useSocialStore } from "@/components/parent/social-store"

const records = {
  "class-6-parents": { title: "Class 6 Parents", kind: "groups", description: "Discuss homework, carpools, and classroom updates.", members: 24, category: "School" },
  "greenfield-sports": { title: "Greenfield Sports", kind: "groups", description: "Coordinate fixtures, practice, and celebrations.", members: 56, category: "Activities" },
  "robotics-parents": { title: "Robotics Parents", kind: "groups", description: "Share competition news, build sessions, and useful resources.", members: 18, category: "Activities" },
  "weekend-learning-circle": { title: "Weekend Learning Circle", kind: "groups", description: "A friendly space for family learning plans and recommendations.", members: 31, category: "Learning" },
  "greenfield-public-school": { title: "Greenfield Public School", kind: "communities", description: "Announcements, events, and conversations for every family.", members: 248, category: "Schools" },
  "arts-culture": { title: "Arts & Culture", kind: "communities", description: "Share creative opportunities and student showcases.", members: 86, category: "Interests" },
  "young-scientists": { title: "Young Scientists", kind: "communities", description: "Explore experiments, exhibitions, and science fair ideas.", members: 74, category: "Interests" },
  "family-wellness": { title: "Family Wellness", kind: "communities", description: "Practical conversations about routines, balance, and wellbeing.", members: 112, category: "Wellness" },
} as const

export function SocialDetail({ kind, slug }: { kind: "groups" | "communities"; slug: string }) {
  const record = records[slug as keyof typeof records]
  const { joined, toggleJoined, following, toggleFollowing } = useSocialStore()
  if (!record || record.kind !== kind) return <PageShell title="Not found" description="This social space is no longer available." icon={Users}><Link href={`/parent/${kind}`} className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium">Back to {kind}</Link></PageShell>
  const isJoined = joined.includes(slug)
  const isFollowing = following.includes(slug)
  return <PageShell title={record.title} description={record.description} icon={kind === "groups" ? Users : Bell}>
    <div className="flex flex-col gap-5"><Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 rounded-xl px-0 text-sm font-medium text-brand"><ArrowLeft />Back to {kind}</Link>
      <Card className="overflow-hidden border-brand/15"><div className="bg-gradient-to-br from-brand-muted via-background to-background p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className="grid size-16 place-items-center rounded-2xl bg-brand text-xl font-bold text-brand-foreground">{record.title.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span><div><Badge variant="secondary" className="bg-brand-muted text-brand">{record.category}</Badge><h2 className="mt-2 font-display text-2xl font-bold">{record.title}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />{record.members + (isJoined ? 1 : 0)} members</p></div></div><div className="flex flex-wrap gap-2"><Button variant={isJoined ? "secondary" : "default"} className="rounded-xl" onClick={() => toggleJoined(slug)}>{isJoined ? <><Check data-icon="inline-start" />Joined</> : "Join"}</Button><Button variant={isFollowing ? "secondary" : "outline"} className="rounded-xl" onClick={() => toggleFollowing(slug)}>{isFollowing ? "Following" : "Follow"}</Button><Button variant="outline" size="icon" className="rounded-xl" aria-label="Settings"><Settings /></Button></div></div></div></Card>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="grid gap-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 font-display"><MessageCircle className="text-brand" />Discussions</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Start a conversation, share an update, or ask other families for advice.</p><Button className="mt-4 rounded-xl">Start a discussion</Button></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 font-display"><CalendarDays className="text-brand" />Updates and events</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">No upcoming events yet. New announcements will appear here.</p></CardContent></Card></div><Card><CardHeader><CardTitle className="font-display">Members</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{["Rashi Kapoor", "Priya Sharma", "Kabir Mehta"].map((name, index) => <div key={name} className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-brand-muted text-sm font-semibold text-brand">{name.split(" ").map((word) => word[0]).join("")}</span><span className="text-sm font-medium">{name}</span></div>{index === 0 && <Badge variant="secondary">You</Badge>}</div>)}</CardContent></Card></div>
    </div></PageShell>
}
