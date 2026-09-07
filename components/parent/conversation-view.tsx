"use client"

import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react"
import useSWR from "swr"
import { ArrowLeft, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  getConversation,
  markConversationRead,
  sendMessage,
  type ConversationMessage,
} from "@/app/actions/messages"
import { useMessagesStore } from "@/components/parent/messages-store"
import { cn } from "@/lib/utils"

// Poll the open conversation on the same cadence as the inbox so incoming
// replies appear near-real-time using only the existing Neon database.
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

export function ConversationView({
  otherUserId,
  fallbackName,
  fallbackAvatar,
  onBack,
}: {
  otherUserId: string
  fallbackName: string
  fallbackAvatar: string
  onBack: () => void
}) {
  const { refresh: refreshInbox } = useMessagesStore()
  const { data, mutate, isLoading } = useSWR(
    ["parent-conversation", otherUserId],
    () => getConversation(otherUserId),
    { refreshInterval: POLL_INTERVAL_MS, revalidateOnFocus: true },
  )

  const [draft, setDraft] = useState("")
  const [isSending, startSending] = useTransition()
  const [sendError, setSendError] = useState<string | null>(null)

  const person = data?.person
  const messages = data?.messages ?? []
  const displayName = person?.name ?? fallbackName
  const displayAvatar = person?.avatar || fallbackAvatar

  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep the newest message in view whenever the history grows or we switch person.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length, otherUserId])

  // Mark incoming unread messages as read once the conversation is open (reusing
  // the existing markConversationRead action), then refresh both this panel and
  // the inbox so the header badge and list unread counts drop to zero.
  const hasUnreadIncoming = messages.some((message) => !message.mine && message.readAt === null)
  useEffect(() => {
    if (!hasUnreadIncoming) return
    let cancelled = false
    markConversationRead(otherUserId)
      .then(() => {
        if (cancelled) return
        mutate()
        refreshInbox()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [hasUnreadIncoming, otherUserId, mutate, refreshInbox])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || isSending) return
    setSendError(null)
    startSending(async () => {
      try {
        // Reuse the existing sendMessage server action — the single write path.
        await sendMessage(otherUserId, body)
        setDraft("")
        await mutate() // Refetch so the just-sent message appears immediately.
        refreshInbox() // Update the left preview/timestamp and re-sort the inbox.
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
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={displayAvatar || "/placeholder.svg"} alt="" />
          <AvatarFallback>{initialsOf(displayName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{displayName}</p>
          {person?.headline && (
            <p className="truncate text-xs text-muted-foreground">{person.headline}</p>
          )}
        </div>
      </div>

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
              No messages yet — say hello to {displayName}.
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
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

function MessageBubble({ message }: { message: ConversationMessage }) {
  return (
    <div className={cn("flex", message.mine ? "justify-end" : "justify-start")}>
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
