"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Bell, BellOff, Check, Copy, Lock, LogOut, MoreHorizontal, Search, Settings, UserPlus, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { useFeedStore, draftToPost, readPostFocus, clearPostFocus } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"
import { CURRENT_PARENT, INVITE_CONTACTS, otherMemberNames } from "@/lib/parent-data"

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
}

export function SocialDetail({ kind, slug }: { kind: "groups" | "communities"; slug: string }) {
  const { getSpace, joined, toggleJoined, following, toggleFollowing, hydrated } = useSocialStore()
  const { posts, addPost, removePost } = useFeedStore()
  const [invited, setInvited] = useState<string[]>([])
  const [muted, setMuted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const record = getSpace(slug)

  useEffect(() => {
    const id = readPostFocus()
    if (!id) return
    const timer = window.setTimeout(() => {
      document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      setFocusedId(id)
      clearPostFocus()
      window.setTimeout(() => setFocusedId(null), 2200)
    }, 150)
    return () => window.clearTimeout(timer)
  }, [slug])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  const backLabel = kind === "groups" ? "Back to Groups" : "Back to Communities"

  if (!record || record.kind !== kind) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"><ArrowLeft className="size-4" />{backLabel}</Link>
        <Card className="mt-5 items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand"><Users className="size-7" /></span>
          <h2 className="font-display text-lg font-semibold">This space is no longer available</h2>
          <p className="max-w-sm text-sm text-muted-foreground">It may have been removed or the link is incorrect.</p>
        </Card>
      </div>
    )
  }

  const isJoined = joined.includes(slug)
  const isFollowing = following.includes(slug)
  const isGroup = kind === "groups"
  const isMember = isGroup ? isJoined : isFollowing

  // Wait for the persisted membership state before rendering anything private, so member-only
  // content (feed, composer, members, invites) never flashes before the access check applies.
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"><ArrowLeft className="size-4" />{backLabel}</Link>
        <Card className="mt-5 h-48 animate-pulse bg-muted/40" aria-hidden />
        <span className="sr-only">Loading {isGroup ? "group" : "community"}…</span>
      </div>
    )
  }

  // Access control: someone who has not joined/followed only sees the public name and description,
  // plus the action to join/follow. All member-only content is withheld from the route itself.
  if (!isMember) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"><ArrowLeft className="size-4" />{backLabel}</Link>
        <Card className="overflow-hidden border-brand/15">
          <div className="bg-gradient-to-br from-brand-muted via-background to-background p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className={`grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ${record.tone}`}>{record.initials}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-brand-muted text-brand">{record.category}</Badge>
                  <Badge variant="outline" className="gap-1 text-muted-foreground">{isGroup ? "Group" : "Community"} · {record.privacy}</Badge>
                </div>
                <h1 className="mt-2 font-display text-2xl font-bold text-balance">{record.title}</h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">{record.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Users className="size-4" />{record.members} members</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand"><Lock className="size-7" /></span>
            <h2 className="font-display text-lg font-semibold">{isGroup ? "This group is members only" : "This community is for followers"}</h2>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">{isGroup ? "Join this group to see group updates and connect with members." : "Follow this community to see community updates and connect with members."}</p>
            <Button className="mt-1 rounded-xl" onClick={() => (isGroup ? toggleJoined(slug) : toggleFollowing(slug))}>{isGroup ? <><UserPlus data-icon="inline-start" />Join group</> : <><UserPlus data-icon="inline-start" />Follow</>}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const invitedContacts = INVITE_CONTACTS.filter((contact) => invited.includes(contact.id))
  const memberCount = record.members + (isMember ? 1 : 0) + invitedContacts.length
  // Single source of truth: the current parent appears in the roster only while actually a member.
  const rosterNames = isMember ? [CURRENT_PARENT, ...otherMemberNames(record)] : otherMemberNames(record)
  const feedPosts = posts.filter((post) => post.scope === slug)

  function handlePost(draft: Draft) {
    addPost(draftToPost(draft, { author: CURRENT_PARENT, subtitle: `Parent of Aarav Kapoor · ${record!.title}`, avatar: "/avatar-rashi.png", scope: slug }))
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/parent/${kind}/${slug}`) } catch {}
    setCopied(true); setMenuOpen(false); window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"><ArrowLeft className="size-4" />{backLabel}</Link>

      {/* Header */}
      <Card className="overflow-hidden border-brand/15">
        <div className="bg-gradient-to-br from-brand-muted via-background to-background p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className={`grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ${record.tone}`}>{record.initials}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-brand-muted text-brand">{record.category}</Badge>
                  <Badge variant="outline" className="gap-1 text-muted-foreground">{isGroup ? "Group" : "Community"} · {record.privacy}</Badge>
                </div>
                <h1 className="mt-2 font-display text-2xl font-bold text-balance">{record.title}</h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground text-pretty">{record.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Users className="size-4" />{memberCount} members</p>
              </div>
            </div>
            <div className="relative flex shrink-0 flex-wrap items-center gap-2">
              {isGroup ? (
                <Button variant={isJoined ? "secondary" : "default"} className="rounded-xl" onClick={() => toggleJoined(slug)}>{isJoined ? <><Check data-icon="inline-start" />Joined</> : "Join group"}</Button>
              ) : (
                <Button variant={isFollowing ? "secondary" : "default"} className="rounded-xl" onClick={() => toggleFollowing(slug)}>{isFollowing ? <><Check data-icon="inline-start" />Following</> : "Follow"}</Button>
              )}
              <Button variant="outline" size="icon" className="rounded-xl" aria-label="Space options" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
                <Settings className="size-4" />
              </Button>
              {menuOpen && (
                <div ref={menuRef} className="absolute right-0 top-12 z-20 grid min-w-52 gap-1 rounded-xl border border-border bg-card p-1 shadow-lg">
                  <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { setMuted((value) => !value); setMenuOpen(false) }}>{muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}{muted ? "Unmute notifications" : "Mute notifications"}</button>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" onClick={copyLink}><Copy className="size-4" />Copy invite link</button>
                  <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={() => { if (isGroup) { if (isJoined) toggleJoined(slug) } else if (isFollowing) toggleFollowing(slug); setMenuOpen(false) }}><LogOut className="size-4" />{isGroup ? (isJoined ? "Leave group" : "Not a member") : isFollowing ? "Unfollow" : "Not following"}</button>
                </div>
              )}
            </div>
          </div>
          {copied && <p className="mt-3 w-fit rounded-lg bg-brand-muted px-3 py-1.5 text-sm text-brand">Invite link copied to clipboard</p>}
          {muted && <p className="mt-3 w-fit rounded-lg bg-secondary px-3 py-1.5 text-sm text-muted-foreground">Notifications are muted for this {isGroup ? "group" : "community"}</p>}
        </div>
      </Card>

      {/* Feed + members */}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <PostComposer onPost={handlePost} />
          {feedPosts.length ? (
            feedPosts.map((post) => <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onRemove={() => removePost(post.id)} /></div>)
          ) : (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-brand-muted text-brand"><Users className="size-6" /></span><p className="font-semibold">No posts yet</p><p className="text-sm text-muted-foreground">Be the first to share an update with this {isGroup ? "group" : "community"}.</p></CardContent></Card>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="font-display text-base">Members</CardTitle>
              <Badge variant="secondary" className="bg-brand-muted text-brand">{memberCount}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rosterNames.slice(0, 5).map((name) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium">{name}</span>
                  </div>
                  {name === CURRENT_PARENT && <Badge variant="secondary">You</Badge>}
                </div>
              ))}
              {invitedContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9"><AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} /><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(contact.name)}</AvatarFallback></Avatar>
                    <span className="text-sm font-medium">{contact.name}</span>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">Invited</Badge>
                </div>
              ))}
              <div className="mt-1 grid gap-2">
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setMembersOpen(true)}><Users data-icon="inline-start" />View all members</Button>
                <Button className="w-full rounded-xl" onClick={() => setInviteOpen(true)}><UserPlus data-icon="inline-start" />Invite members</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-display text-base">About</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p className="leading-6">{record.description}</p>
              <p className="flex items-center gap-2"><MoreHorizontal className="size-4 text-brand" />{record.category} · {record.privacy}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <InviteMembersDialog open={inviteOpen} onOpenChange={setInviteOpen} spaceTitle={record.title} invited={invited} onInvite={(ids) => setInvited((current) => Array.from(new Set([...current, ...ids])))} />
      <ViewAllMembersDialog open={membersOpen} onOpenChange={setMembersOpen} spaceTitle={record.title} memberNames={rosterNames} invitedContacts={invitedContacts.map((contact) => contact.name)} />
    </div>
  )
}

function InviteMembersDialog({ open, onOpenChange, spaceTitle, invited, onInvite }: { open: boolean; onOpenChange: (open: boolean) => void; spaceTitle: string; invited: string[]; onInvite: (ids: string[]) => void }) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const results = useMemo(() => INVITE_CONTACTS.filter((contact) => contact.name.toLowerCase().includes(query.toLowerCase())), [query])
  function toggle(id: string) { setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])) }
  function send() { onInvite(selected); setSelected([]); setQuery(""); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) { setSelected([]); setQuery("") } onOpenChange(value) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>Search your network and invite them to {spaceTitle}.</DialogDescription>
        </DialogHeader>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people..." className="h-11 rounded-xl pl-9" aria-label="Search people to invite" /></div>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {results.length ? results.map((contact) => {
            const alreadyInvited = invited.includes(contact.id)
            const isSelected = selected.includes(contact.id)
            return (
              <li key={contact.id}>
                <button type="button" disabled={alreadyInvited} onClick={() => toggle(contact.id)} className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left hover:bg-secondary disabled:opacity-60 disabled:hover:bg-transparent">
                  <Avatar className="size-10"><AvatarImage src={contact.avatar || "/placeholder.svg"} alt={contact.name} /><AvatarFallback>{initialsOf(contact.name)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{contact.name}</p><p className="truncate text-xs text-muted-foreground">{contact.detail}</p></div>
                  {alreadyInvited ? <Badge variant="outline" className="text-muted-foreground">Invited</Badge> : <span className={`grid size-5 place-items-center rounded-full border ${isSelected ? "border-brand bg-brand text-brand-foreground" : "border-input"}`}>{isSelected && <Check className="size-3.5" />}</span>}
                </button>
              </li>
            )
          }) : <li className="p-4 text-center text-sm text-muted-foreground">No people match that search.</li>}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!selected.length} onClick={send}><UserPlus data-icon="inline-start" />Send {selected.length ? `${selected.length} ` : ""}invite{selected.length === 1 ? "" : "s"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ViewAllMembersDialog({ open, onOpenChange, spaceTitle, memberNames, invitedContacts }: { open: boolean; onOpenChange: (open: boolean) => void; spaceTitle: string; memberNames: string[]; invitedContacts: string[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members of {spaceTitle}</DialogTitle>
          <DialogDescription>Everyone in this space.</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {memberNames.map((name, index) => (
            <li key={name} className="flex items-center justify-between gap-3 rounded-xl p-2">
              <div className="flex items-center gap-3">
                <Avatar className="size-9"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                <span className="text-sm font-medium">{name}</span>
              </div>
              {index === 0 && <Badge variant="secondary">You</Badge>}
            </li>
          ))}
          {invitedContacts.map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 rounded-xl p-2">
              <div className="flex items-center gap-3">
                <Avatar className="size-9"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                <span className="text-sm font-medium">{name}</span>
              </div>
              <Badge variant="outline" className="text-muted-foreground">Invited</Badge>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
