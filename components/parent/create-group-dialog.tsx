"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import useSWR from "swr"
import { Check, Search, Users, X } from "lucide-react"
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
import { createGroup, getGroupCandidates, type GroupCandidate } from "@/app/actions/groups"
import { useMessagesStore } from "@/components/parent/messages-store"
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

export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversationId: string) => void
}) {
  const { refresh } = useMessagesStore()
  // Only accepted connections are eligible — the same gate as direct messaging.
  const { data: candidates, isLoading } = useSWR(
    open ? "group-candidates" : null,
    getGroupCandidates,
  )

  const [name, setName] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<GroupCandidate[]>([])
  const [isCreating, startCreating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(() => new Set(selected.map((person) => person.userId)), [selected])

  const filtered = useMemo(() => {
    const list = candidates ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((person) => person.name.toLowerCase().includes(q))
  }, [candidates, query])

  function reset() {
    setName("")
    setQuery("")
    setSelected([])
    setError(null)
  }

  function toggle(person: GroupCandidate) {
    setSelected((current) =>
      current.some((p) => p.userId === person.userId)
        ? current.filter((p) => p.userId !== person.userId)
        : [...current, person],
    )
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (isCreating) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Give your group a name.")
      return
    }
    if (selected.length === 0) {
      setError("Select at least one connection to add.")
      return
    }
    setError(null)
    startCreating(async () => {
      try {
        const conversationId = await createGroup(
          trimmed,
          selected.map((person) => person.userId),
        )
        await refresh()
        reset()
        onOpenChange(false)
        onCreated(conversationId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't create the group.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 p-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-muted text-brand">
              <Users className="size-4" />
            </span>
            New group
          </DialogTitle>
          <DialogDescription>
            Group families you&apos;re connected with into one conversation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Aspira Project Team"
                maxLength={80}
                autoComplete="off"
              />
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Selected members">
                {selected.map((person) => (
                  <span
                    key={person.userId}
                    className="flex items-center gap-1.5 rounded-full bg-brand-muted py-1 pl-1 pr-2 text-xs font-medium text-brand"
                  >
                    <Avatar className="size-5">
                      <AvatarImage src={person.avatar || "/placeholder.svg"} alt="" />
                      <AvatarFallback className="text-[9px]">{initialsOf(person.name)}</AvatarFallback>
                    </Avatar>
                    {person.name}
                    <button
                      type="button"
                      onClick={() => toggle(person)}
                      className="rounded-full p-0.5 transition-colors hover:bg-brand/20"
                      aria-label={`Remove ${person.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="group-search">Add connections</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="group-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your connections"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70">
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
                  {candidates && candidates.length === 0
                    ? "You have no accepted connections to add yet."
                    : "No connections match your search."}
                </p>
              ) : (
                <ul>
                  {filtered.map((person) => {
                    const isSelected = selectedIds.has(person.userId)
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          onClick={() => toggle(person)}
                          aria-pressed={isSelected}
                          className={cn(
                            "flex w-full items-center gap-3 p-2.5 text-left transition-colors",
                            isSelected ? "bg-brand-muted/60" : "hover:bg-muted/60",
                          )}
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
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border transition-colors",
                              isSelected
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-border",
                            )}
                          >
                            {isSelected && <Check className="size-3.5" />}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/70 p-4">
            <p className="text-xs text-muted-foreground">
              {selected.length} selected{selected.length > 0 ? " · you're included" : ""}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !name.trim() || selected.length === 0}>
                {isCreating ? "Creating…" : "Create group"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
