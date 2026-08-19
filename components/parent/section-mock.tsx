"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bell, BookOpen, Check, Globe2, Heart, Layers3, MessageCircle, Search, Users, UserPlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageShell } from "@/components/parent/page-shell"
import { useSocialStore } from "@/components/parent/social-store"
import { INVITE_CONTACTS, type SocialSpace } from "@/lib/parent-data"

type Kind = "groups" | "communities" | "saved" | "timetable" | "network" | "messages"
type SocialKind = "groups" | "communities"

const legacyContent = {
  saved: { title: "Saved Posts", description: "Keep important updates close at hand.", icon: Heart, items: [["Robotics showcase recap", "Saved yesterday", "Aarav's team placed second in the inter-school robotics challenge."], ["Term 2 calendar", "Saved 3 days ago", "Review upcoming events, holidays, and assessment dates."]] },
  timetable: { title: "Timetable", description: "A clear view of your children's school week.", icon: BookOpen, items: [["Monday", "8:00 AM – 3:00 PM", "Mathematics · English · Robotics"], ["Tuesday", "8:00 AM – 3:00 PM", "Science · Art · Physical Education"], ["Wednesday", "8:00 AM – 3:00 PM", "History · Mathematics · Library"]] },
  network: { title: "Parent Network", description: "Find and connect with families in your community.", icon: Users, items: [["Priya Sharma", "Parent of Anaya · Class 6", "Interested in carpooling and weekend learning groups."], ["Kabir Mehta", "Parent of Rohan · Class 6", "Available to help coordinate the next class meetup."]] },
  messages: { title: "Messages", description: "Stay in touch with teachers and parent groups.", icon: MessageCircle, items: [["Ms. Anjali Verma", "Today, 10:42 AM", "Reminder: please send the robotics consent form by Friday."], ["Class 6 Parents", "Yesterday", "Thank you everyone for making the field trip so special."]] },
} as const

const groupCategories = ["School", "Activities", "Learning"]
const communityCategories = ["Schools", "Interests", "Wellness"]

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}
function initialsOf(value: string) {
  return value.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase() || "GC"
}

export function SectionMock({ kind }: { kind: Kind }) {
  if (kind === "groups") return <SocialSection kind="groups" />
  if (kind === "communities") return <SocialSection kind="communities" />
  const section = legacyContent[kind]
  const Icon = section.icon
  return <PageShell title={section.title} description={section.description} icon={Icon}><div className="grid gap-4">{section.items.map(([title, meta, detail]) => <Card key={title} className="border-border/80"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle className="font-display text-lg">{title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{meta}</p></div><Badge variant="secondary" className="bg-brand-muted text-brand">{kind === "messages" ? "New" : "Active"}</Badge></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{detail}</p></CardContent></Card>)}</div></PageShell>
}

function SocialSection({ kind }: { kind: SocialKind }) {
  const [query, setQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [createOpen, setCreateOpen] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const { spaces, joined, toggleJoined, following, toggleFollowing } = useSocialStore()
  const isGroups = kind === "groups"
  const Icon = isGroups ? Users : Globe2
  const sectionSpaces = useMemo(() => spaces.filter((space) => space.kind === kind), [spaces, kind])
  const items = useMemo(() => sectionSpaces.filter((space) => {
    const matchesQuery = `${space.title} ${space.description} ${space.category}`.toLowerCase().includes(query.toLowerCase())
    const isMine = isGroups ? joined.includes(space.slug) : following.includes(space.slug)
    return matchesQuery && (activeFilter === "All" || space.category === activeFilter) && (!mineOnly || isMine)
  }), [activeFilter, query, sectionSpaces, mineOnly, isGroups, joined, following])
  const filters = ["All", ...(isGroups ? groupCategories : communityCategories)]
  return <PageShell title={isGroups ? "Groups" : "Communities"} description={isGroups ? "Connect with families across your school community." : "Discover school communities that match your interests."} icon={Icon}>
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden border-brand/15 bg-gradient-to-br from-brand-muted via-background to-background shadow-sm">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-brand-foreground shadow-sm"><Icon /></span><div><p className="font-display text-lg font-semibold text-foreground">{isGroups ? "Find your parent circle" : "A community for every interest"}</p><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{isGroups ? "Join conversations that make school life easier, friendlier, and more connected." : "Follow spaces where families share ideas, activities, and inspiration."}</p></div></div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isGroups
              ? <Button className="rounded-xl" size="sm" onClick={() => setCreateOpen(true)}><UserPlus data-icon="inline-start" />Create a group</Button>
              : <Button className="rounded-xl" size="sm" onClick={() => setCreateOpen(true)}><UserPlus data-icon="inline-start" />Create a community</Button>}
            {isGroups && <Button variant="outline" size="sm" className="rounded-xl" render={<Link href="/parent/communities" />}><Globe2 data-icon="inline-start" />Explore communities</Button>}
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${kind}...`} className="h-11 rounded-xl pl-9" aria-label={`Search ${kind}`} /></div><div className="flex gap-2 overflow-x-auto pb-1">{filters.map((filter) => <Button key={filter} type="button" size="sm" variant={activeFilter === filter ? "default" : "outline"} className="shrink-0 rounded-xl" onClick={() => setActiveFilter(filter)}>{filter}</Button>)}</div></div>
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{items.length} {isGroups ? "groups" : "communities"} {mineOnly ? "" : "to explore"}</p><Button type="button" variant={mineOnly ? "secondary" : "ghost"} size="sm" className="rounded-xl text-brand" aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)}>{isGroups ? "My groups" : "Following"}</Button></div>
      {items.length ? <div className="grid gap-4 md:grid-cols-2">{items.map((space) => <SocialCard key={space.slug} space={space} isJoined={joined.includes(space.slug)} isFollowing={following.includes(space.slug)} onToggle={() => (isGroups ? toggleJoined(space.slug) : toggleFollowing(space.slug))} />)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-12 text-center"><Layers3 className="size-8 text-muted-foreground" /><p className="font-semibold">{mineOnly ? (isGroups ? "You haven't joined any groups yet" : "You're not following any communities yet") : "Nothing matches that search"}</p><p className="text-sm text-muted-foreground">{mineOnly ? (isGroups ? "Join a group to see it here." : "Follow a community to see it here.") : "Try another keyword or reset your filter."}</p><Button variant="outline" className="mt-2 rounded-xl" onClick={() => { setQuery(""); setActiveFilter("All"); setMineOnly(false) }}>{mineOnly ? "Browse all" : "Clear filters"}</Button></CardContent></Card>}
    </div>
    <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} kind={kind} />
  </PageShell>
}

function SocialCard({ space, isJoined, isFollowing, onToggle }: { space: SocialSpace; isJoined: boolean; isFollowing: boolean; onToggle: () => void }) {
  const isGroups = space.kind === "groups"
  const active = isGroups ? isJoined : isFollowing
  const detailHref = `/parent/${space.kind}/${space.slug}`
  return <Card className="border-border/80 transition-shadow hover:shadow-md"><Link href={detailHref} className="block"><CardHeader className="flex flex-row items-start gap-3"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold ${space.tone}`}>{space.initials}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><CardTitle className="font-display text-lg leading-tight">{space.title}</CardTitle><Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">{space.category}</Badge></div><CardDescription className="mt-1 flex items-center gap-1.5"><Users className="size-3.5" />{space.members} members</CardDescription></div></CardHeader></Link><CardContent><p className="text-sm leading-6 text-muted-foreground">{space.description}</p></CardContent><CardFooter className="flex items-center justify-between gap-3 border-t bg-muted/20 pt-4"><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MessageCircle className="size-3.5" />Active discussions</span><span className="flex items-center gap-1"><Bell className="size-3.5" />Updates</span></div><Button size="sm" variant={active ? "secondary" : "default"} className="rounded-xl" onClick={onToggle}>{active ? <><Check data-icon="inline-start" />{isGroups ? "Joined" : "Following"}</> : <><UserPlus data-icon="inline-start" />{isGroups ? "Join" : "Follow"}</>}</Button></CardFooter></Card>
}

function CreateSpaceDialog({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (open: boolean) => void; kind: SocialKind }) {
  const router = useRouter()
  const { addSpace, spaces } = useSocialStore()
  const isGroups = kind === "groups"
  const categories = isGroups ? groupCategories : communityCategories
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(categories[0])
  const [privacy, setPrivacy] = useState<"Public" | "Private">(isGroups ? "Private" : "Public")
  const [invitees, setInvitees] = useState<string[]>([])

  function reset() { setName(""); setDescription(""); setCategory(categories[0]); setPrivacy(isGroups ? "Private" : "Public"); setInvitees([]) }
  function toggleInvitee(id: string) { setInvitees((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])) }
  function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    let slug = slugify(trimmed)
    if (spaces.some((space) => space.slug === slug)) slug = `${slug}-${Date.now().toString().slice(-4)}`
    const inviteeNames = INVITE_CONTACTS.filter((contact) => invitees.includes(contact.id)).map((contact) => contact.name)
    const space: SocialSpace = {
      slug,
      kind,
      title: trimmed,
      description: description.trim() || `A ${isGroups ? "group" : "community"} for ${trimmed}.`,
      category,
      // `members` counts everyone other than you (matches the seeded spaces); the detail page adds +1 while you are joined.
      members: inviteeNames.length,
      tone: "bg-violet-100 text-violet-700",
      initials: initialsOf(trimmed),
      privacy,
      memberNames: ["Rashi Kapoor", ...inviteeNames],
    }
    addSpace(space)
    reset()
    onOpenChange(false)
    router.push(`/parent/${kind}/${slug}`)
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) reset(); onOpenChange(value) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a {isGroups ? "group" : "community"}</DialogTitle>
          <DialogDescription>Set up a dedicated space and invite families to join the conversation.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="space-name">{isGroups ? "Group" : "Community"} name</Label><Input id="space-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={isGroups ? "e.g. Class 6 Parents" : "e.g. Young Scientists"} /></div>
          <div className="grid gap-2"><Label htmlFor="space-desc">Description</Label><Textarea id="space-desc" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this space about?" /></div>
          <div className="grid gap-2"><Label>Category</Label><div className="flex flex-wrap gap-2">{categories.map((option) => <Button key={option} type="button" size="sm" variant={category === option ? "default" : "outline"} className="rounded-xl" onClick={() => setCategory(option)}>{option}</Button>)}</div></div>
          <div className="grid gap-2"><Label>Privacy</Label><div className="flex flex-wrap gap-2">{(["Public", "Private"] as const).map((option) => <Button key={option} type="button" size="sm" variant={privacy === option ? "default" : "outline"} className="rounded-xl" onClick={() => setPrivacy(option)}>{option}</Button>)}</div></div>
          <div className="grid gap-2"><Label>Invite members <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label><ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-1">{INVITE_CONTACTS.map((contact) => { const selected = invitees.includes(contact.id); return <li key={contact.id}><button type="button" onClick={() => toggleInvitee(contact.id)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"><Avatar className="size-8"><AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} /><AvatarFallback>{initialsOf(contact.name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium">{contact.name}</span><span className={`grid size-5 place-items-center rounded-full border ${selected ? "border-brand bg-brand text-brand-foreground" : "border-input"}`}>{selected && <Check className="size-3.5" />}</span></button></li> })}</ul></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim()} onClick={create}>Create {isGroups ? "group" : "community"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GroupsSection() { return <SectionMock kind="groups" /> }
export function CommunitiesSection() { return <SectionMock kind="communities" /> }

function Hashtags({ tags }: { tags: string[] }) { return <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div> }
export { Hashtags }

export function SectionIcon({ kind }: { kind: string }) { return <span className="text-brand">{kind}</span> }
