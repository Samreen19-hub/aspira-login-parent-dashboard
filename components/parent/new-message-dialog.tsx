"use client"

import { useMemo, useState } from "react"
import { MessageCircle, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMessagesStore, type InboxItem } from "@/components/parent/messages-store"

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

// Starts a one-to-one message. The list of eligible people is the existing set of
// accepted connections, which the Messages store already exposes as its `direct`
// inbox items (connected people appear even before any message exists). Choosing a
// person hands their user id back to the parent, which opens that person's existing
// 1-to-1 conversation in the right-hand panel — reusing the conversation rather than
// creating a duplicate. No new data layer, table, or connection logic is involved.
export function NewMessageDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (userId: string) => void
}) {
  const { conversations, isLoading } = useMessagesStore()
  const [query, setQuery] = useState("")

  const people = useMemo(
    () => conversations.filter((item): item is InboxItem => item.kind === "direct"),
    [conversations],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return people
    return people.filter((person) => person.name.toLowerCase().includes(q))
  }, [people, query])

  function handleOpenChange(next: boolean) {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  function choose(userId: string) {
    setQuery("")
    onOpenChange(false)
    onSelect(userId)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 p-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-muted text-brand">
              <MessageCircle className="size-4" />
            </span>
            New message
          </DialogTitle>
          <DialogDescription>Pick a connection to start a one-to-one conversation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-message-search">Your connections</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="new-message-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your connections"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70">
            {isLoading ? (
              <div className="grid gap-2 p-3" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="flex items-center gap-3">
                    <div className="size-9 animate-pulse rounded-full bg-muted" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {people.length === 0
                  ? "You have no accepted connections to message yet."
                  : "No connections match your search."}
              </p>
            ) : (
              <ul>
                {filtered.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      onClick={() => choose(person.id)}
                      className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted/60"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarImage src={person.avatar || "/placeholder.svg"} alt="" />
                        <AvatarFallback>{initialsOf(person.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{person.name}</p>
                        {person.headline && (
                          <p className="truncate text-xs text-muted-foreground">{person.headline}</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-border/70 p-4">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
