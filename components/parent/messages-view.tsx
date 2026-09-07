"use client"

import { MessageCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { PageShell } from "@/components/parent/page-shell"
import { useMessagesStore } from "@/components/parent/messages-store"
import type { ConversationSummary } from "@/app/actions/messages"
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

  return (
    <PageShell title="Messages" description="Your conversations with connected families." icon={MessageCircle}>
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
            Connect with families in your Network and they&apos;ll show up here so you can start a
            conversation.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.userId} conversation={conversation} />
          ))}
        </ul>
      )}
    </PageShell>
  )
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  const { name, avatar, headline, lastMessage, lastMessageAt, lastMessageMine, unreadCount } =
    conversation
  const hasUnread = unreadCount > 0

  // Conversation rows are intentionally non-interactive in this release: the chat screen is not
  // built yet, so there is no routing to a conversation page.
  const preview = lastMessage
    ? `${lastMessageMine ? "You: " : ""}${lastMessage}`
    : headline || "You're connected — say hello"

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-4 transition-colors",
          hasUnread ? "border-brand/30 bg-brand-muted/40" : "border-border/70 bg-card",
        )}
      >
        <Avatar className="size-11 shrink-0">
          <AvatarImage src={avatar || "/placeholder.svg"} alt="" />
          <AvatarFallback>{initialsOf(name)}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className={cn("truncate text-sm", hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground")}>
              {name}
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
      </div>
    </li>
  )
}
