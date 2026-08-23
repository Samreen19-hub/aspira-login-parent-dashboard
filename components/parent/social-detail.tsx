"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bell, BellOff, Check, Copy, Lock, LogOut, MoreHorizontal, Search, Settings, ShieldCheck, Trash2, UserMinus, UserPlus, Users } from "lucide-react"
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
  const { getSpace, joined, toggleJoined, following, toggleFollowing, isAdmin, getAdmins, makeAdmin, leaveSpace, removeSpace, removeMember, getRemovedMembers, hydrated } = useSocialStore()
  const { posts, addPost, removePost, removePostsByScope } = useFeedStore()
  const router = useRouter()
  const [invited, setInvited] = useState<string[]>([])
  const [muted, setMuted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  // Member the admin is about to remove (drives the confirmation dialog). Null when idle.
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  // Member/follower the admin is about to promote to admin. Null when idle.
  const [makeAdminTarget, setMakeAdminTarget] = useState<string | null>(null)
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
  // Owner/admin always has full access regardless of Public/Private, and is not required to
  // manually join/follow (the store already assigns membership on creation).
  const admin = isAdmin(slug)
  const hasFullAccess = admin || isMember
  const isPublic = record.privacy === "Public"
  // Public spaces let anyone read the feed and basic info; private spaces reveal nothing until
  // the parent joins/follows. Full access (member/follower/admin) always sees everything.
  const canViewPosts = hasFullAccess || isPublic

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

  // Access control for PRIVATE spaces: someone who has not joined/followed only sees the public
  // name and description, plus the action to join/follow. All other content — posts, composer,
  // members, invites — is withheld from the route itself, so direct navigation is also blocked.
  if (!canViewPosts) {
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
  // Members/followers the admin has removed. Excluded from the roster and subtracted from the count.
  const removedForSpace = getRemovedMembers(slug)
  const otherMembers = otherMemberNames(record).filter((name) => !removedForSpace.includes(name))
  const memberCount = record.members + (isMember ? 1 : 0) + invitedContacts.length - removedForSpace.length
  // Single source of truth: the current parent appears in the roster only while actually a member.
  const rosterNames = isMember ? [CURRENT_PARENT, ...otherMembers] : otherMembers
  const feedPosts = posts.filter((post) => post.scope === slug)

  // --- Admin leave rules --------------------------------------------------
  // Admins besides the current parent. If any remain, the parent may leave freely because at
  // least one admin still owns the space.
  const admins = getAdmins(slug)
  const otherAdmins = admins.filter((name) => name !== CURRENT_PARENT)
  // Other members/followers who could inherit ownership (roster excluding the parent, anyone
  // already an admin, and anyone the admin has removed).
  const transferCandidates = otherMembers.filter((name) => !admins.includes(name))
  const isSoleAdmin = admin && otherAdmins.length === 0
  // Sole admin with other members/followers must hand off ownership before leaving. Sole admin
  // with nobody else cannot leave the space ownerless and is offered deletion instead.
  const mustTransferBeforeLeaving = isSoleAdmin && transferCandidates.length > 0
  const soleAdminNoOthers = isSoleAdmin && transferCandidates.length === 0

  function handlePost(draft: Draft) {
    addPost(draftToPost(draft, { author: CURRENT_PARENT, subtitle: `Parent of Aarav Kapoor · ${record!.title}`, avatar: "/avatar-rashi.png", scope: slug }))
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/parent/${kind}/${slug}`) } catch {}
    setCopied(true); setMenuOpen(false); window.setTimeout(() => setCopied(false), 1800)
  }

  // Admin-only. Removes the space and its scoped posts, then returns to the listing so the user
  // is never left on a broken detail route.
  function handleDelete() {
    removePostsByScope(slug)
    removeSpace(slug)
    setDeleteOpen(false)
    router.push(`/parent/${kind}`)
  }

  // Non-admins, and admins with a co-admin, leave directly. Admins who are the sole admin go
  // through the dialog (transfer ownership, or delete when nobody else is present).
  function handleLeaveClick() {
    if (admin && isSoleAdmin) { setLeaveOpen(true); setMenuOpen(false); return }
    leaveSpace(slug)
    setMenuOpen(false)
    router.push(`/parent/${kind}`)
  }

  // Sole admin picks a member/follower to inherit ownership; they become admin and the current
  // parent leaves immediately as a normal member/follower.
  function handleTransferAndLeave(newAdmin: string) {
    leaveSpace(slug, newAdmin)
    setLeaveOpen(false)
    router.push(`/parent/${kind}`)
  }

  // Admin-only. Confirms removing the pending member/follower from the space.
  function handleConfirmRemove() {
    if (removeTarget) removeMember(slug, removeTarget)
    setRemoveTarget(null)
  }

  // Admin-only. Confirms promoting the pending member/follower to admin. Existing admins remain.
  function handleConfirmMakeAdmin() {
    if (makeAdminTarget) makeAdmin(slug, makeAdminTarget)
    setMakeAdminTarget(null)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <Link href={`/parent/${kind}`} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"><ArrowLeft className="size-4" />{backLabel}</Link>

      {/* Header. overflow-visible (overriding the Card default overflow-hidden) so the admin
          settings dropdown — which extends below the card edge — is never clipped. The inner
          gradient keeps rounded corners so the card visual is unchanged. */}
      <Card className="overflow-visible border-brand/15">
        <div className="rounded-xl bg-gradient-to-br from-brand-muted via-background to-background p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className={`grid size-16 shrink-0 place-items-center rounded-2xl text-xl font-bold ${record.tone}`}>{record.initials}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-brand-muted text-brand">{record.category}</Badge>
                  <Badge variant="outline" className="gap-1 text-muted-foreground">{isGroup ? "Group" : "Community"} · {record.privacy}</Badge>
                  {admin && <Badge variant="secondary" className="gap-1 bg-brand text-brand-foreground"><ShieldCheck className="size-3.5" />Admin</Badge>}
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
                  {admin ? (
                    <>
                      {/* Admin sees BOTH leave and delete. Leaving as sole admin opens the
                          transfer/delete flow; with a co-admin it leaves immediately. */}
                      <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" onClick={handleLeaveClick}><LogOut className="size-4" />{isGroup ? "Leave group" : "Unfollow"}</button>
                      <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={() => { setDeleteOpen(true); setMenuOpen(false) }}><Trash2 className="size-4" />{isGroup ? "Delete group" : "Delete community"}</button>
                    </>
                  ) : (
                    <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={() => { if (isGroup) { if (isJoined) toggleJoined(slug) } else if (isFollowing) toggleFollowing(slug); setMenuOpen(false) }}><LogOut className="size-4" />{isGroup ? (isJoined ? "Leave group" : "Not a member") : isFollowing ? "Unfollow" : "Not following"}</button>
                  )}
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
          {hasFullAccess ? (
            <PostComposer onPost={handlePost} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-muted text-brand"><Lock className="size-5" /></span>
                <p className="flex-1 text-sm leading-6 text-muted-foreground">{isGroup ? "Join this group to participate and post updates." : "Follow this community to participate and post updates."}</p>
                <Button className="rounded-xl" onClick={() => (isGroup ? toggleJoined(slug) : toggleFollowing(slug))}><UserPlus data-icon="inline-start" />{isGroup ? "Join group" : "Follow"}</Button>
              </CardContent>
            </Card>
          )}
          {feedPosts.length ? (
            feedPosts.map((post) => <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onRemove={hasFullAccess ? () => removePost(post.id) : undefined} /></div>)
          ) : (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center gap-2 p-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-brand-muted text-brand"><Users className="size-6" /></span><p className="font-semibold">No posts yet</p><p className="text-sm text-muted-foreground">Be the first to share an update with this {isGroup ? "group" : "community"}.</p></CardContent></Card>
          )}
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          {/* Members and invites are only ever shown to members/followers/admins. Public
              non-members can read the feed but never see who is in the space. */}
          {hasFullAccess && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="font-display text-base">Members</CardTitle>
              <Badge variant="secondary" className="bg-brand-muted text-brand">{memberCount}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {rosterNames.slice(0, 5).map((name) => {
                // Admin identification is visible to every member/follower, not just admins.
                const isRowAdmin = admins.includes(name)
                return (
                  <div key={name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isRowAdmin ? (
                        <Badge variant="secondary" className="gap-1 bg-brand text-brand-foreground"><ShieldCheck className="size-3" />Admin</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Member</span>
                      )}
                      {name === CURRENT_PARENT && <Badge variant="secondary">You</Badge>}
                    </div>
                  </div>
                )
              })}
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
                <Button variant="outline" className="w-full rounded-xl" onClick={() => setMembersOpen(true)}><Users data-icon="inline-start" />{admin ? "Manage members" : "View all members"}</Button>
                {/* Inviting is an admin management control only. */}
                {admin && <Button className="w-full rounded-xl" onClick={() => setInviteOpen(true)}><UserPlus data-icon="inline-start" />Invite members</Button>}
              </div>
            </CardContent>
          </Card>
          )}

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
      <ViewAllMembersDialog open={membersOpen} onOpenChange={setMembersOpen} spaceTitle={record.title} memberNames={rosterNames} invitedContacts={invitedContacts.map((contact) => contact.name)} admins={admins} canManage={admin} onRequestRemove={(name) => setRemoveTarget(name)} onRequestMakeAdmin={(name) => setMakeAdminTarget(name)} />
      {admin && <DeleteSpaceDialog open={deleteOpen} onOpenChange={setDeleteOpen} isGroup={isGroup} memberCount={memberCount} onConfirm={handleDelete} />}
      {admin && <RemoveMemberDialog open={removeTarget !== null} onOpenChange={(value) => { if (!value) setRemoveTarget(null) }} isGroup={isGroup} memberName={removeTarget ?? ""} onConfirm={handleConfirmRemove} />}
      {admin && <MakeAdminDialog open={makeAdminTarget !== null} onOpenChange={(value) => { if (!value) setMakeAdminTarget(null) }} isGroup={isGroup} memberName={makeAdminTarget ?? ""} onConfirm={handleConfirmMakeAdmin} />}
      {admin && (
        <LeaveSpaceDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          isGroup={isGroup}
          mustTransfer={mustTransferBeforeLeaving}
          candidates={transferCandidates}
          onTransferAndLeave={handleTransferAndLeave}
          onDeleteInstead={() => { setLeaveOpen(false); setDeleteOpen(true) }}
        />
      )}
    </div>
  )
}

// Admin can delete a space even when it still has members — deletion is never blocked on emptying
// the roster. The current member count is shown so the admin knows exactly what they're removing.
function DeleteSpaceDialog({ open, onOpenChange, isGroup, memberCount, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; isGroup: boolean; memberCount: number; onConfirm: () => void }) {
  const memberLabel = `${memberCount} ${memberCount === 1 ? "member" : "members"}`
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isGroup ? "Delete Group?" : "Delete Community?"}</DialogTitle>
          <DialogDescription>
            {isGroup
              ? `This group has ${memberLabel}. Deleting this group will permanently remove the group, its posts, events, and membership information. This action cannot be undone.`
              : `This community has ${memberLabel}. Deleting this community will permanently remove the community, its posts, events, and membership information. This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}><Trash2 data-icon="inline-start" />{isGroup ? "Delete Group" : "Delete Community"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Admin-only confirmation before removing a member/follower from the space.
function RemoveMemberDialog({ open, onOpenChange, isGroup, memberName, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; isGroup: boolean; memberName: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove member?</DialogTitle>
          <DialogDescription>
            {memberName} will be removed from this {isGroup ? "group" : "community"} and will no longer have access to member-only content.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}><UserMinus data-icon="inline-start" />Remove Member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Admin-only confirmation before promoting a member/follower to admin. Existing admins are kept,
// so the space can have multiple admins.
function MakeAdminDialog({ open, onOpenChange, isGroup, memberName, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; isGroup: boolean; memberName: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make Admin?</DialogTitle>
          <DialogDescription>
            {memberName} will become an Admin of this {isGroup ? "group" : "community"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm}><ShieldCheck data-icon="inline-start" />Make Admin</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Shown only to a sole admin who wants to leave. If eligible members/followers exist, the admin
// must transfer ownership to one of them and then leaves immediately as a normal member/follower.
// If nobody else remains, leaving would orphan the space, so deletion is offered instead.
function LeaveSpaceDialog({ open, onOpenChange, isGroup, mustTransfer, candidates, onTransferAndLeave, onDeleteInstead }: { open: boolean; onOpenChange: (open: boolean) => void; isGroup: boolean; mustTransfer: boolean; candidates: string[]; onTransferAndLeave: (newAdmin: string) => void; onDeleteInstead: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => { if (!open) setSelected(null) }, [open])
  const leaveWord = isGroup ? "leave this group" : "unfollow this community"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mustTransfer ? "Transfer admin & leave" : isGroup ? "You’re the only admin" : "You’re the only admin"}</DialogTitle>
          <DialogDescription>
            {mustTransfer
              ? `You’re the only admin of this ${isGroup ? "group" : "community"}. Choose a ${isGroup ? "member" : "follower"} to become the new admin. They’ll take over ownership and you’ll ${leaveWord} right away.`
              : `You’re the only admin and there’s no one else to take over, so you can’t ${leaveWord} without leaving it ownerless. You can delete the ${isGroup ? "group" : "community"} instead.`}
          </DialogDescription>
        </DialogHeader>
        {mustTransfer ? (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((name) => {
              const isSelected = selected === name
              return (
                <li key={name}>
                  <button type="button" onClick={() => setSelected(name)} className={`flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors ${isSelected ? "border-brand bg-brand-muted" : "border-transparent hover:bg-secondary"}`}>
                    <Avatar className="size-10"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                    <span className={`grid size-5 place-items-center rounded-full border ${isSelected ? "border-brand bg-brand text-brand-foreground" : "border-input"}`}>{isSelected && <Check className="size-3.5" />}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {mustTransfer ? (
            <Button disabled={!selected} onClick={() => selected && onTransferAndLeave(selected)}><ShieldCheck data-icon="inline-start" />Transfer &amp; {isGroup ? "leave" : "unfollow"}</Button>
          ) : (
            <Button variant="destructive" onClick={onDeleteInstead}><Trash2 data-icon="inline-start" />{isGroup ? "Delete group" : "Delete community"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// Admin identification (the Admin badge) is shown to everyone. When `canManage` is set (admin),
// each eligible member/follower also gets "Make Admin" and Remove actions. The current parent
// (always first, badged "You") can never be removed here — self-exit uses Leave/Unfollow.
function ViewAllMembersDialog({ open, onOpenChange, spaceTitle, memberNames, invitedContacts, admins, canManage, onRequestRemove, onRequestMakeAdmin }: { open: boolean; onOpenChange: (open: boolean) => void; spaceTitle: string; memberNames: string[]; invitedContacts: string[]; admins: string[]; canManage?: boolean; onRequestRemove?: (name: string) => void; onRequestMakeAdmin?: (name: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members of {spaceTitle}</DialogTitle>
          <DialogDescription>{canManage ? "Manage who has access to this space." : "Everyone in this space."}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {memberNames.map((name, index) => {
            const isSelf = name === CURRENT_PARENT
            const isRowAdmin = admins.includes(name)
            return (
              <li key={name} className="flex items-center justify-between gap-3 rounded-xl p-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-9"><AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback></Avatar>
                  <span className="truncate text-sm font-medium">{name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* Admin role is always identified. */}
                  {isRowAdmin && <Badge variant="secondary" className="gap-1 bg-brand text-brand-foreground"><ShieldCheck className="size-3" />Admin</Badge>}
                  {index === 0 && isSelf && <Badge variant="secondary">You</Badge>}
                  {/* Admin-only controls. Only offered for other members who are not yet admins. */}
                  {canManage && !isSelf && !isRowAdmin && (
                    <>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={() => onRequestMakeAdmin?.(name)}><ShieldCheck data-icon="inline-start" />Make Admin</Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRequestRemove?.(name)}><UserMinus data-icon="inline-start" />Remove</Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
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
