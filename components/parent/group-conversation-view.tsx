"use client"

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react"
import useSWR from "swr"
import { ArrowLeft, Send, Trash2, UserMinus, UserPlus, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  deleteGroup,
  getGroupConversation,
  markGroupRead,
  removeGroupMember,
  sendGroupMessage,
  type GroupMessage,
} from "@/app/actions/groups"
import { AddMembersDialog } from "@/components/parent/add-members-dialog"
import { useMessagesStore } from "@/components/parent/messages-store"
import { cn } from "@/lib/utils"

// Poll on the same cadence as the inbox so group replies appear near-real-time
// using only the existing Neon database.
const POLL_INTERVAL_MS = 4000

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A"
  )
}

function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

// Fixed saturation/lightness that stays readable on both the light card (white)
// and the dark card (near-black) for every hue. Applied as an inline `style`
// (not a Tailwind class) so the colour is guaranteed to render and can never be
// purged, merged away, or overridden by another `text-*` utility on the span.
const NAME_SATURATION = 65
const NAME_LIGHTNESS = 45

// Fallback colour for a sender who is NOT in the current member list (e.g. a
// member who left but whose past messages remain). Uses a well-distributed
// FNV-1a hash spread across the full hue circle. The previous implementation
// hashed with a weak `*31` polynomial into a 12-entry array; real Aspira UUIDs
// collapsed onto the same bucket, so every member's name rendered the same
// green. FNV-1a over 360 hues avoids that bucket collapse.
function senderColor(senderId: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < senderId.length; i++) {
    hash ^= senderId.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const hue = hash % 360
  return `hsl(${hue} ${NAME_SATURATION}% ${NAME_LIGHTNESS}%)`
}

// Deterministic, maximally-separated colour per member. Sorting the member ids
// gives a stable order regardless of query/render order, and spreading the hue
// evenly around the circle by index guarantees adjacent members are visibly
// different (3 members => hues 120deg apart) — something per-id hashing cannot
// guarantee because of collisions. The same member keeps the same colour across
// re-renders and refreshes as long as the membership set is unchanged. The
// current user is included, so their own name gets a colour too.
function buildMemberColors(memberIds: string[]): Map<string, string> {
  const sorted = [...memberIds].sort()
  const count = Math.max(sorted.length, 1)
  const map = new Map<string, string>()
  sorted.forEach((id, index) => {
    // Offset the starting hue so the first member isn't pure red.
    const hue = Math.round((210 + (index * 360) / count) % 360)
    map.set(id, `hsl(${hue} ${NAME_SATURATION}% ${NAME_LIGHTNESS}%)`)
  })
  return map
}

export function GroupConversationView({
  conversationId,
  fallbackName,
  onBack,
}: {
  conversationId: string
  fallbackName: string
  onBack: () => void
}) {
  const { refresh: refreshInbox } = useMessagesStore()
  const { data, mutate, isLoading } = useSWR(
    ["parent-group-conversation", conversationId],
    () => getGroupConversation(conversationId),
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true },
  )

  const [draft, setDraft] = useState("")
  const [isSending, startSending] = useTransition()
  const [sendError, setSendError] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, startDeleting] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const conversation = data?.conversation
  const messages = data?.messages ?? []
  const displayName = conversation?.name ?? fallbackName

  // Even-spread colour per current member, keyed by user id. Recomputed only
  // when the member set changes. `colorFor` falls back to the hash-based colour
  // for any sender no longer in the group (e.g. a removed member's old messages).
  const memberIds = (conversation?.members ?? []).map((member) => member.userId).join(",")
  const memberColors = useMemo(
    () => buildMemberColors(memberIds ? memberIds.split(",") : []),
    [memberIds],
  )
  const colorFor = (senderId: string) => memberColors.get(senderId) ?? senderColor(senderId)
  const memberCount = conversation?.memberCount ?? 0
  const viewerId = conversation?.viewerId ?? null
  const viewerIsCreator = conversation?.viewerIsCreator ?? false

  function handleRemoveMember(memberId: string) {
    if (removingId) return
    setRemoveError(null)
    setRemovingId(memberId)
    startDeleting(async () => {
      try {
        await removeGroupMember(conversationId, memberId)
        await mutate()
        refreshInbox()
      } catch (error) {
        setRemoveError(error instanceof Error ? error.message : "Couldn't remove that member.")
      } finally {
        setRemovingId(null)
      }
    })
  }

  function handleDeleteGroup() {
    if (isDeleting) return
    setDeleteError(null)
    startDeleting(async () => {
      try {
        await deleteGroup(conversationId)
        setShowDeleteConfirm(false)
        // Return to the normal Messages state and drop the group from the list.
        onBack()
        refreshInbox()
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Couldn't delete this group.")
      }
    })
  }

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, conversationId])

  // Mark the group read once it's open (advances only this user's watermark),
  // then refresh so the header badge and left-column unread count drop.
  const latestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null
  useEffect(() => {
    if (!conversationId) return
    let cancelled = false
    markGroupRead(conversationId)
      .then(() => {
        if (cancelled) return
        refreshInbox()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [conversationId, latestAt, refreshInbox])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || isSending) return
    setSendError(null)
    startSending(async () => {
      try {
        await sendGroupMessage(conversationId, body)
        setDraft("")
        await mutate()
        refreshInbox()
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "Couldn't send your message.")
      }
    })
  }

  // Do not submit while a CJK IME is composing (Enter confirms composition).
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
      event.preventDefault()
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center gap-3 border-b border-border/70 p-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl lg:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-muted text-brand">
          <Users className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{displayName}</p>
          <button
            type="button"
            onClick={() => setShowMembers((value) => !value)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            aria-expanded={showMembers}
          >
            {memberCount} {memberCount === 1 ? "member" : "members"}
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 rounded-xl"
          onClick={() => setShowAddMembers(true)}
        >
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">Add members</span>
        </Button>
        {viewerIsCreator && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-xl text-destructive hover:text-destructive"
            onClick={() => {
              setDeleteError(null)
              setShowDeleteConfirm(true)
            }}
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Delete group</span>
          </Button>
        )}
      </div>

      {conversation && (
        <AddMembersDialog
          conversationId={conversationId}
          groupName={displayName}
          open={showAddMembers}
          onOpenChange={setShowAddMembers}
          onAdded={() => {
            // Refresh this conversation (member list/count) and the inbox row.
            mutate()
            refreshInbox()
          }}
        />
      )}

      {showMembers && conversation && (
        <div className="border-b border-border/70 bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Members
          </p>
          <ul className="flex flex-wrap gap-2">
            {conversation.members.map((member) => {
              const isSelf = member.userId === viewerId
              return (
                <li
                  key={member.userId}
                  className="flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-1.5 text-xs font-medium text-foreground"
                >
                  <Avatar className="size-5">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} alt="" />
                    <AvatarFallback className="text-[9px]">{initialsOf(member.name)}</AvatarFallback>
                  </Avatar>
                  <span className="pl-0.5">
                    {member.name}
                    {isSelf && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={removingId !== null}
                      className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                      aria-label={`Remove ${member.name} from the group`}
                    >
                      <UserMinus className="size-3" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {removeError && <p className="mt-2 text-xs font-medium text-destructive">{removeError}</p>}
        </div>
      )}

      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !isDeleting && setShowDeleteConfirm(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <span className="grid size-8 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="size-4" />
              </span>
              Delete group
            </DialogTitle>
            <DialogDescription>
              This permanently deletes {'"'}
              {displayName}
              {'"'} and all of its messages for everyone. This can&apos;t be undone. Your direct messages
              and other groups aren&apos;t affected.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-xs font-medium text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && !data ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className={cn("flex", row % 2 === 0 ? "justify-start" : "justify-end")}>
                <div className="h-9 w-40 animate-pulse rounded-2xl bg-muted" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <p className="max-w-xs text-sm text-muted-foreground">
              No messages yet — say hello to the group.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            // Show the sender name/avatar only at the start of a run from the
            // same person (received messages only).
            const previous = messages[index - 1]
            const showSender = !message.mine && previous?.senderId !== message.senderId
            return (
              <GroupBubble
                key={message.id}
                message={message}
                showSender={showSender}
                nameColor={colorFor(message.senderId)}
              />
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border/70 p-3">
        {sendError && <p className="mb-2 text-xs font-medium text-destructive">{sendError}</p>}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${displayName}`}
            aria-label={`Message ${displayName}`}
            className="h-11 flex-1 rounded-xl border border-border bg-muted px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-xl"
            disabled={!draft.trim() || isSending}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function GroupBubble({
  message,
  showSender,
  nameColor,
}: {
  message: GroupMessage
  showSender: boolean
  nameColor: string
}) {
  return (
    <div className={cn("flex flex-col", message.mine ? "items-end" : "items-start")}>
      {showSender && (
        <span className="mb-0.5 ml-1 text-xs font-semibold" style={{ color: nameColor }}>
          {message.senderName}
        </span>
      )}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm",
          message.mine
            ? "rounded-br-md bg-brand text-brand-foreground"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={cn(
            "mt-1 text-[10px]",
            message.mine ? "text-brand-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatMessageTime(message.createdAt)}
        </p>
      </div>
    </div>
  )
}
