"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { getSpaceCounts, getInviteableUsers, getConnectionInviteableUsers, inviteToSpace, listSpacesPage, type SpaceScope } from "@/app/actions/spaces"
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
import type { SocialSpace } from "@/lib/parent-data"

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

const PAGE_SIZE = 12

function SocialSection({ kind }: { kind: SocialKind }) {
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("All")
  const [createOpen, setCreateOpen] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  // Membership/following state + toggles come from the store; the spaces
  // THEMSELVES are paginated from the DB (never the full store array), so the
  // browser only ever holds the pages actually viewed.
  const { joined, toggleJoined, following, toggleFollowing } = useSocialStore()
  // Member/follower counts come from the DB (public.space_members), never a static number.
  const { data: counts, mutate: mutateCounts } = useSWR("space-counts", getSpaceCounts, { revalidateOnFocus: false })
  const isGroups = kind === "groups"
  const Icon = isGroups ? Users : Globe2
  // `all` = eligible discovery (groups) / every public community; `mine` =
  // joined groups / followed communities. The universe is resolved SERVER-SIDE.
  const scope: SpaceScope = mineOnly ? "mine" : "all"

  // Debounce the search box so typing doesn't fire a DB query per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  // DB-backed, paginated discovery. Eligibility (for groups) and public/followed
  // scope (for communities) are decided server-side; category and search are SQL
  // predicates. Each page fetches `limit + 1` rows so `hasMore` needs no count.
  const { data, size, setSize, isValidating, mutate } = useSWRInfinite(
    (index, previous: { items: SocialSpace[]; hasMore: boolean } | null) => {
      if (previous && !previous.hasMore) return null
      return ["spaces-page", kind, scope, activeFilter, debouncedQuery, index] as const
    },
    ([, k, s, category, search, index]) =>
      listSpacesPage({ kind: k, scope: s, category, search, limit: PAGE_SIZE, offset: index * PAGE_SIZE }),
    { revalidateOnFocus: false, revalidateFirstPage: false },
  )

  // Any filter/scope change collapses discovery back to the first page.
  useEffect(() => { setSize(1) }, [kind, scope, activeFilter, debouncedQuery, setSize])

  const pages = data ?? []
  const items = pages.flatMap((page) => page.items)
  const hasMore = pages.length > 0 ? pages[pages.length - 1].hasMore : false
  const isLoading = data === undefined
  const isLoadingMore = isValidating && pages.length > 0 && pages.length < size
  const filters = ["All", ...(isGroups ? groupCategories : communityCategories)]

  // A join/leave (or follow/unfollow) changes the counts and, for the `mine`
  // scope, which spaces appear — so revalidate the visible pages and the counts
  // after every toggle. Any rejection message is returned for inline display.
  async function handleToggle(slug: string) {
    const result = isGroups ? await toggleJoined(slug) : await toggleFollowing(slug)
    await Promise.all([mutate(), mutateCounts()])
    return result
  }

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
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{items.length}{hasMore ? "+" : ""} {isGroups ? (mineOnly ? "groups joined" : "groups to explore") : (mineOnly ? "following" : "communities to explore")}</p><Button type="button" variant={mineOnly ? "secondary" : "ghost"} size="sm" className="rounded-xl text-brand" aria-pressed={mineOnly} onClick={() => setMineOnly((value) => !value)}>{isGroups ? "My groups" : "Following"}</Button></div>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Card key={index} className="h-52 animate-pulse bg-muted/40" aria-hidden />)}</div>
      ) : items.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">{items.map((space) => <SocialCard key={space.slug} space={space} memberCount={counts?.[space.slug] ?? 0} isJoined={joined.includes(space.slug)} isFollowing={following.includes(space.slug)} onToggle={() => handleToggle(space.slug)} />)}</div>
          {hasMore && <div className="flex justify-center"><Button variant="outline" className="rounded-xl" disabled={isLoadingMore} onClick={() => setSize(size + 1)}>{isLoadingMore ? "Loading…" : `Load more ${isGroups ? "groups" : "communities"}`}</Button></div>}
        </>
      ) : <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-12 text-center"><Layers3 className="size-8 text-muted-foreground" /><p className="font-semibold">{mineOnly ? (isGroups ? "You haven't joined any groups yet" : "You're not following any communities yet") : "Nothing matches that search"}</p><p className="text-sm text-muted-foreground">{mineOnly ? (isGroups ? "Join a group to see it here." : "Follow a community to see it here.") : "Try another keyword or reset your filter."}</p><Button variant="outline" className="mt-2 rounded-xl" onClick={() => { setQuery(""); setActiveFilter("All"); setMineOnly(false) }}>{mineOnly ? "Browse all" : "Clear filters"}</Button></CardContent></Card>}
    </div>
    <CreateSpaceDialog open={createOpen} onOpenChange={setCreateOpen} kind={kind} />
  </PageShell>
}

function SocialCard({ space, memberCount, isJoined, isFollowing, onToggle }: { space: SocialSpace; memberCount: number; isJoined: boolean; isFollowing: boolean; onToggle: () => Promise<string | null> }) {
  const isGroups = space.kind === "groups"
  const active = isGroups ? isJoined : isFollowing
  const detailHref = `/parent/${space.kind}/${space.slug}`
  // A group join can be rejected by its join policy (connections / invite only);
  // the rejection message is shown inline under the action so the parent knows
  // why nothing happened. Communities (Follow) never hit this.
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function handleToggle() {
    setError(null)
    setPending(true)
    const result = await onToggle()
    setPending(false)
    if (result) setError(result)
  }
  return <Card className="border-border/80 transition-shadow hover:shadow-md"><Link href={detailHref} className="block"><CardHeader className="flex flex-row items-start gap-3"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-bold ${space.tone}`}>{space.initials}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><CardTitle className="font-display text-lg leading-tight">{space.title}</CardTitle><Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground">{space.category}</Badge></div><CardDescription className="mt-1 flex items-center gap-1.5"><Users className="size-3.5" />{memberCount} {isGroups ? "members" : "followers"}</CardDescription></div></CardHeader></Link><CardContent><p className="text-sm leading-6 text-muted-foreground">{space.description}</p></CardContent><CardFooter className="flex flex-col items-stretch gap-2 border-t bg-muted/20 pt-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><MessageCircle className="size-3.5" />Active discussions</span><span className="flex items-center gap-1"><Bell className="size-3.5" />Updates</span></div><Button size="sm" variant={active ? "secondary" : "default"} className="rounded-xl" disabled={pending} onClick={handleToggle}>{active ? <><Check data-icon="inline-start" />{isGroups ? "Joined" : "Following"}</> : <><UserPlus data-icon="inline-start" />{isGroups ? "Join" : "Follow"}</>}</Button></div>{error && <p role="alert" className="text-xs leading-5 text-destructive">{error}</p>}</CardFooter></Card>
}

function CreateSpaceDialog({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (open: boolean) => void; kind: SocialKind }) {
  const router = useRouter()
  const { addSpace } = useSocialStore()
  const isGroups = kind === "groups"
  const categories = isGroups ? groupCategories : communityCategories
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState(categories[0])
  // GROUPS choose who may join via a join policy. COMMUNITIES are always public
  // (Follow), so they have no selector and this state is simply ignored for them.
  const [joinPolicy, setJoinPolicy] = useState<"anyone" | "connections" | "invite">("anyone")
  const [invitees, setInvitees] = useState<string[]>([])
  // WHO the invite picker offers (and whether it shows at all):
  //   - Invite-only GROUP → ONLY the creator's accepted connections, so an
  //     invite-only group can never be seeded with strangers.
  //   - Anyone / My-connections GROUP → picker hidden entirely (no invitations;
  //     access is decided by the join policy, not by a seed invite list).
  //   - COMMUNITY → any real user, as an OPTIONAL sharing feature — community
  //     invitations never gate access (communities are always public/Follow).
  const inviteMode: "connections" | "all" | "none" = isGroups
    ? (joinPolicy === "invite" ? "connections" : "none")
    : "all"
  const showInvite = inviteMode !== "none"
  // Real users to invite, from the DB (neon_auth.user + profiles) — never a dummy
  // list. Connections-only for invite-only groups; all users for communities.
  const { data: people } = useSWR(
    open && showInvite ? ["invite-users", inviteMode] : null,
    () => (inviteMode === "connections" ? getConnectionInviteableUsers() : getInviteableUsers()),
    { revalidateOnFocus: false },
  )

  function reset() { setName(""); setDescription(""); setCategory(categories[0]); setJoinPolicy("anyone"); setInvitees([]) }
  function selectPolicy(value: "anyone" | "connections" | "invite") {
    setJoinPolicy(value)
    // Invitees only apply to an invite-only group; drop any selection when
    // switching to a policy whose picker is hidden so nothing stale is sent.
    if (value !== "invite") setInvitees([])
  }
  function toggleInvitee(id: string) { setInvitees((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])) }
  async function create() {
    const trimmed = name.trim()
    if (!trimmed) return
    const slug = slugify(trimmed)
    const space: SocialSpace = {
      slug,
      kind,
      title: trimmed,
      description: description.trim() || `A ${isGroups ? "group" : "community"} for ${trimmed}.`,
      category,
      // Member/follower counts now come from the DB (public.space_members); this static field
      // is unused for counts but kept to satisfy the shared SocialSpace shape.
      members: 0,
      tone: "bg-violet-100 text-violet-700",
      initials: initialsOf(trimmed),
      // Groups are always stored Public now (access is governed by joinPolicy);
      // communities are inherently public too.
      privacy: "Public",
      // Group access control; communities always resolve to `anyone` (Follow).
      joinPolicy: isGroups ? joinPolicy : "anyone",
      // Selected invitees are NOT members — they become real pending rows in
      // space_invitations below, so no dummy names are stored here.
      memberNames: [],
    }
    // Records the creator as an ADMIN member in the DB (auto-join + auto-admin) and returns the
    // FINAL server-assigned slug (guaranteed unique), which we use for invites AND navigation so
    // a slug collision can never send the creator to the wrong space or invite into it.
    const finalSlug = (await addSpace(space)) ?? slug
    // Persist the chosen invitees as REAL pending invitations (not memberships). They stay
    // `pending` in space_invitations until each user actually joins/accepts. Only invite-only
    // groups and communities ever carry invitees here.
    if (invitees.length) { try { await inviteToSpace(finalSlug, invitees) } catch {} }
    reset()
    onOpenChange(false)
    router.push(`/parent/${kind}/${finalSlug}`)
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
          {isGroups && <div className="grid gap-2"><Label>Who can join</Label><div className="flex flex-wrap gap-2">{([["anyone", "Anyone"], ["connections", "My connections"], ["invite", "Invite only"]] as const).map(([value, label]) => <Button key={value} type="button" size="sm" variant={joinPolicy === value ? "default" : "outline"} className="rounded-xl" onClick={() => setJoinPolicy(value)}>{label}</Button>)}</div><p className="text-xs text-muted-foreground">{joinPolicy === "anyone" ? "Any parent can find and join this group." : joinPolicy === "connections" ? "Only your accepted connections can join this group." : "Only people you invite can join this group."}</p></div>}
          <div className="grid gap-2"><Label>Invite members <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label><ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-1">{people === undefined ? <li className="p-3 text-sm text-muted-foreground">Loading members…</li> : people.length === 0 ? <li className="p-3 text-sm text-muted-foreground">No other members to invite yet.</li> : people.map((person) => { const selected = invitees.includes(person.userId); return <li key={person.userId}><button type="button" onClick={() => toggleInvitee(person.userId)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-secondary"><Avatar className="size-8"><AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} /><AvatarFallback>{initialsOf(person.name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span><span className={`grid size-5 place-items-center rounded-full border ${selected ? "border-brand bg-brand text-brand-foreground" : "border-input"}`}>{selected && <Check className="size-3.5" />}</span></button></li> })}</ul></div>
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
