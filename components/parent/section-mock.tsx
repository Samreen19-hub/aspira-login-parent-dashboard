"use client"

import { useMemo, useState } from "react"
import { Bell, BookOpen, Check, Globe2, Heart, Layers3, MapPin, MessageCircle, Search, Users, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageShell } from "@/components/parent/page-shell"
import { useSocialStore } from "@/components/parent/social-store"
import Link from "next/link"

type Kind = "groups" | "communities" | "saved" | "timetable" | "network" | "messages"
type SocialKind = "groups" | "communities"

type SocialItem = {
  title: string
  meta: string
  detail: string
  category: string
  members: string
  tone: string
  initials: string
  joined?: boolean
}

const content = {
  groups: { title: "Groups", description: "Connect with families across your school community.", icon: Users, items: [
    { title: "Class 6 Parents", meta: "24 members", detail: "Discuss homework, carpools, and classroom updates.", category: "School", members: "24 members", tone: "bg-violet-100 text-violet-700", initials: "C6" },
    { title: "Greenfield Sports", meta: "56 members", detail: "Coordinate fixtures, practice, and celebrations.", category: "Activities", members: "56 members", tone: "bg-blue-100 text-blue-700", initials: "GS" },
    { title: "Robotics Parents", meta: "18 members", detail: "Share competition news, build sessions, and useful resources.", category: "Activities", members: "18 members", tone: "bg-amber-100 text-amber-700", initials: "RP" },
    { title: "Weekend Learning Circle", meta: "31 members", detail: "A friendly space for family learning plans and recommendations.", category: "Learning", members: "31 members", tone: "bg-emerald-100 text-emerald-700", initials: "WL" },
  ] as SocialItem[] },
  communities: { title: "Communities", description: "Discover school communities that match your interests.", icon: Globe2, items: [
    { title: "Greenfield Public School", meta: "School community", detail: "Announcements, events, and conversations for every family.", category: "Schools", members: "248 members", tone: "bg-violet-100 text-violet-700", initials: "GP" },
    { title: "Arts & Culture", meta: "Open community", detail: "Share creative opportunities and student showcases.", category: "Interests", members: "86 members", tone: "bg-pink-100 text-pink-700", initials: "AC" },
    { title: "Young Scientists", meta: "Open community", detail: "Explore experiments, exhibitions, and science fair ideas.", category: "Interests", members: "74 members", tone: "bg-cyan-100 text-cyan-700", initials: "YS" },
    { title: "Family Wellness", meta: "Open community", detail: "Practical conversations about routines, balance, and wellbeing.", category: "Wellness", members: "112 members", tone: "bg-emerald-100 text-emerald-700", initials: "FW" },
  ] as SocialItem[] },
  saved: { title: "Saved Posts", description: "Keep important updates close at hand.", icon: Heart, items: [["Robotics showcase recap", "Saved yesterday", "Aarav's team placed second in the inter-school robotics challenge."], ["Term 2 calendar", "Saved 3 days ago", "Review upcoming events, holidays, and assessment dates."]] },
  timetable: { title: "Timetable", description: "A clear view of your children's school week.", icon: BookOpen, items: [["Monday", "8:00 AM – 3:00 PM", "Mathematics · English · Robotics"], ["Tuesday", "8:00 AM – 3:00 PM", "Science · Art · Physical Education"], ["Wednesday", "8:00 AM – 3:00 PM", "History · Mathematics · Library"]] },
  network: { title: "Parent Network", description: "Find and connect with families in your community.", icon: Users, items: [["Priya Sharma", "Parent of Anaya · Class 6", "Interested in carpooling and weekend learning groups."], ["Kabir Mehta", "Parent of Rohan · Class 6", "Available to help coordinate the next class meetup."]] },
  messages: { title: "Messages", description: "Stay in touch with teachers and parent groups.", icon: MessageCircle, items: [["Ms. Anjali Verma", "Today, 10:42 AM", "Reminder: please send the robotics consent form by Friday."], ["Class 6 Parents", "Yesterday", "Thank you everyone for making the field trip so special."]] },
} as const

const filters = ["All", "School", "Activities", "Learning", "Interests", "Wellness"]

export function SectionMock({ kind }: { kind: Kind }) {
  const section = content[kind]
  if (kind === "groups") return <SocialSection kind="groups" section={content.groups} />
  if (kind === "communities") return <SocialSection kind="communities" section={content.communities} />
  const legacySection = section as unknown as { title: string; description: string; icon: React.ElementType; items: readonly (readonly [string, string, string])[] }
  const Icon = legacySection.icon
  return <PageShell title={legacySection.title} description={legacySection.description} icon={Icon}><div className="grid gap-4">{legacySection.items.map(([title, meta, detail]) => <Card key={title} className="border-border/80"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="font-display text-lg">{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{meta}</p></div><Badge variant="secondary" className="bg-brand-muted text-brand">{kind === "messages" ? "New" : "Active"}</Badge></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{detail}</p></CardContent></Card>)}</div></PageShell>
}

function SocialSection({ kind, section }: { kind: SocialKind; section: typeof content[SocialKind] }) {
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const { joined, toggleJoined, following, toggleFollowing } = useSocialStore()
  const items = useMemo(() => section.items.filter((item) => {
    const matchesQuery = `${item.title} ${item.detail} ${item.category}`.toLowerCase().includes(query.toLowerCase())
    return matchesQuery && (activeFilter === "All" || item.category === activeFilter)
  }), [activeFilter, query, section.items])
  const Icon = section.icon
  const isGroups = kind === "groups"
  return <PageShell title={section.title} description={section.description} icon={Icon}>
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden border-brand/15 bg-gradient-to-br from-brand-muted via-background to-background shadow-sm">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm"><Icon /></span><div><p className="font-display text-lg font-semibold text-foreground">{isGroups ? "Find your parent circle" : "A community for every interest"}</p><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{isGroups ? "Join conversations that make school life easier, friendlier, and more connected." : "Follow spaces where families share ideas, activities, and inspiration."}</p></div></div>
          <Button className="rounded-xl" size="sm"><UserPlus data-icon="inline-start" />{isGroups ? "Create a group" : "Explore communities"}</Button>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind}...`} className="h-11 rounded-xl pl-9" aria-label={`Search ${kind}`} /></div><div className="flex gap-2 overflow-x-auto pb-1">{filters.filter((filter) => isGroups ? ["All", "School", "Activities", "Learning"].includes(filter) : ["All", "Schools", "Interests", "Wellness"].includes(filter)).map((filter) => <Button key={filter} type="button" size="sm" variant={activeFilter === filter ? "default" : "outline"} className="shrink-0 rounded-xl" onClick={() => setActiveFilter(filter)}>{filter}</Button>)}</div></div>
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{items.length} {isGroups ? "groups" : "communities"} to explore</p><Button variant="ghost" size="sm" className="rounded-xl text-brand">{isGroups ? "My groups" : "Following"}</Button></div>
      {items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <SocialCard key={item.title} item={item} kind={kind} isJoined={joined.includes(item.title)} isFollowing={following.includes(item.title)} onToggle={() => toggleJoined(item.title)} onFollow={() => toggleFollowing(item.title)} />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-12 text-center"><Layers3 className="size-8 text-muted-foreground" /><p className="font-semibold">Nothing matches that search</p><p className="text-sm text-muted-foreground">Try another keyword or reset your filter.</p><Button variant="outline" className="mt-2 rounded-xl" onClick={() => { setQuery(""); setActiveFilter("All") }}>Clear filters</Button></CardContent></Card>}
    </div>
  </PageShell>
}

function SocialCard({ item, kind, isJoined, isFollowing, onToggle, onFollow }: { item: SocialItem; kind: SocialKind; isJoined: boolean; isFollowing: boolean; onToggle: () => void; onFollow: () => void }) {
  const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  const detailHref = `/parent/${kind}/${slug}`
  return <Card className="border-border/80 transition-shadow hover:shadow-md"><Link href={detailHref} className="block"><CardHeader className="flex flex-row items-start gap-3"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold ${item.tone}`}>{item.initials}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><CardTitle className="font-display text-lg leading-tight">{item.title}</CardTitle><Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">{item.category}</Badge></div><CardDescription className="mt-1 flex items-center gap-1.5"><Users className="size-3.5" />{item.members}</CardDescription></div></CardHeader></Link><CardContent><p className="text-sm leading-6 text-muted-foreground">{item.detail}</p></CardContent><CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/20 pt-4"><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MessageCircle className="size-3.5" />Active discussions</span><span className="flex items-center gap-1"><Bell className="size-3.5" />Updates</span></div><Button size="sm" variant={isJoined ? "secondary" : "default"} className="rounded-xl" onClick={onToggle}>{isJoined ? <><Check data-icon="inline-start" />Joined</> : <><UserPlus data-icon="inline-start" />Join</>}</Button></CardFooter></Card>
}

export function GroupsSection() { return <SectionMock kind="groups" /> }
export function CommunitiesSection() { return <SectionMock kind="communities" /> }

function Hashtags({ tags }: { tags: string[] }) { return <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div> }
export { Hashtags }

export function SectionIcon({ kind }: { kind: string }) { return <span className="text-brand">{kind}</span> }
