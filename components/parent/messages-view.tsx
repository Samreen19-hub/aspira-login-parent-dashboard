"use client"

import { useState } from "react"
import { MessageCircle, Users, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useMessagesStore, type InboxItem } from "@/components/parent/messages-store"
import { ConversationView } from "@/components/parent/conversation-view"
import { GroupConversationView } from "@/components/parent/group-conversation-view"
import { CreateGroupDialog } from "@/components/parent/create-group-dialog"
import { cn } from "@/lib/utils"

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

// A stable key for the selected row that distinguishes a direct conversation
// (keyed by the other user's id) from a group (keyed by conversation id).
function keyOf(item: InboxItem) {
  return `${item.kind}:${item.id}`
}

// Renders the message time the way inboxes do: a clock time for today, "Yesterday" for the previous
// day, otherwise a short date. Purely presentational — sorting is done on the server.
function formatTimestamp(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000)

  if (dayDiff <= 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  if (dayDiff === 1) return "Yesterday"
  if (dayDiff < 7) return date.toLocaleDateString(undefined, { weekday: "short" })
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function MessagesView() {
  const { conversations, isLoading, error } = useMessagesStore()
  // The currently open conversation, identified by its composite key. On desktop the list and the
  // conversation are shown side by side; on mobile the conversation replaces the list until Back.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const selected = conversations.find((conversation) => keyOf(conversation) === selectedKey) ?? null

  return (
    <div className="mx-auto flex h-[calc(100svh-7rem)] max-w-[1200px] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-muted text-brand">
          <MessageCircle className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground text-balance">Messages</h1>
          <p className="text-sm text-muted-foreground">Your conversations with connected families.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
          <UserPlus className="size-4" />
          <span className="hidden sm:inline">New group</span>
          <span className="sm:hidden">Group</span>
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_1fr]">
        {/* LEFT COLUMN — the inbox list (direct + group), now selectable. */}
        <aside className={cn("min-h-0 flex-col", selected ? "hidden lg:flex" : "flex")}>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-xl">
            {isLoading ? (
              <div className="grid gap-2" aria-busy="true">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-center gap-3 rounded-xl border border-border/70 p-4">
                    <div className="size-11 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <Card className="items-center gap-2 p-10 text-center">
                <p className="font-semibold text-foreground">Couldn&apos;t load your messages</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Something went wrong reaching the server. It will retry automatically.
                </p>
              </Card>
            ) : conversations.length === 0 ? (
              <Card className="items-center gap-2 p-10 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
                  <MessageCircle className="size-7" />
                </span>
                <p className="font-display text-lg font-semibold text-foreground">No conversations yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Connect with families in your Network and they&apos;ll show up here, or start a group with
                  New group.
                </p>
              </Card>
            ) : (
              <ul className="grid gap-2">
                {conversations.map((conversation) => (
                  <ConversationRow
                    key={keyOf(conversation)}
                    conversation={conversation}
                    isActive={keyOf(conversation) === selectedKey}
                    onSelect={() => setSelectedKey(keyOf(conversation))}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN — the active conversation (direct or group). */}
        <section className={cn("min-h-0", selected ? "block" : "hidden lg:block")}>
          {selected ? (
            selected.kind === "group" ? (
              <GroupConversationView
                key={keyOf(selected)}
                conversationId={selected.id}
                fallbackName={selected.name}
                onBack={() => setSelectedKey(null)}
              />
            ) : (
              <ConversationView
                key={keyOf(selected)}
                otherUserId={selected.id}
                fallbackName={selected.name}
                fallbackAvatar={selected.avatar}
                onBack={() => setSelectedKey(null)}
              />
            )
          ) : (
            <div className="grid h-full place-items-center rounded-xl border border-border/70 bg-card p-10 text-center">
              <div className="grid justify-items-center gap-2">
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
                  <MessageCircle className="size-7" />
                </span>
                <p className="font-display text-lg font-semibold text-foreground">Select a conversation</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Choose a conversation from the list to view your messages and reply.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(conversationId) => setSelectedKey(`group:${conversationId}`)}
      />
    </div>
  )
}

function ConversationRow({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: InboxItem
  isActive: boolean
  onSelect: () => void
}) {
  const {
    kind,
    name,
    avatar,
    headline,
    lastMessage,
    lastMessageAt,
    lastMessageMine,
    lastMessageSenderName,
    unreadCount,
  } = conversation
  const hasUnread = unreadCount > 0
  const isGroup = kind === "group"

  // Preview text. Groups prefix the sender's first name (or "You:"); direct rows
  // keep the existing "You:"/plain preview and fall back to the headline.
  let preview: string
  if (lastMessage) {
    const prefix = lastMessageMine
      ? "You: "
      : isGroup && lastMessageSenderName
        ? `${lastMessageSenderName}: `
        : ""
    preview = `${prefix}${lastMessage}`
  } else {
    preview = isGroup ? headline || "New group — say hello" : headline || "You're connected — say hello"
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors",
          isActive
            ? "border-brand bg-brand-muted/60"
            : hasUnread
              ? "border-brand/30 bg-brand-muted/40 hover:bg-brand-muted/50"
              : "border-border/70 bg-card hover:bg-muted/60",
        )}
      >
        {isGroup ? (
          <span
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-muted text-brand"
            aria-hidden="true"
          >
            <Users className="size-5" />
          </span>
        ) : (
          <Avatar className="size-11 shrink-0">
            <AvatarImage src={avatar || "/placeholder.svg"} alt="" />
            <AvatarFallback>{initialsOf(name)}</AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p
              className={cn(
                "flex min-w-0 items-center gap-1.5 truncate text-sm",
                hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground",
              )}
            >
              {isGroup && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Group
                </span>
              )}
              <span className="truncate">{name}</span>
            </p>
            <span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(lastMessageAt)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <p
              className={cn(
                "truncate text-sm",
                hasUnread ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {preview}
            </p>
            {hasUnread && (
              <span
                className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-foreground"
                aria-label={`${unreadCount} unread ${unreadCount === 1 ? "message" : "messages"}`}
              >
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )
}
