"use client"

import { useMemo, useState, useTransition, type FormEvent } from "react"
import useSWR from "swr"
import { Check, Search, UserPlus, X } from "lucide-react"
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
import { addGroupMembers, getAddableConnections, type GroupCandidate } from "@/app/actions/groups"
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

export function AddMembersDialog({
  conversationId,
  groupName,
  open,
  onOpenChange,
  onAdded,
}: {
  conversationId: string
  groupName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  // Only accepted connections who are NOT already in this group — the same
  // accepted-connection gate as group creation, minus current members.
  const { data: candidates, isLoading } = useSWR(
    open ? ["group-addable", conversationId] : null,
    () => getAddableConnections(conversationId),
  )

  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<GroupCandidate[]>([])
  const [isAdding, startAdding] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const selectedIds = useMemo(() => new Set(selected.map((person) => person.userId)), [selected])

  const filtered = useMemo(() => {
    const list = candidates ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((person) => person.name.toLowerCase().includes(q))
  }, [candidates, query])

  function reset() {
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
    if (isAdding) return
    if (selected.length === 0) {
      setError("Select at least one connection to add.")
      return
    }
    setError(null)
    startAdding(async () => {
      try {
        await addGroupMembers(
          conversationId,
          selected.map((person) => person.userId),
        )
        reset()
        onOpenChange(false)
        onAdded()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add members.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/70 p-4 text-left">
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="grid size-8 place-items-center rounded-xl bg-brand-muted text-brand">
              <UserPlus className="size-4" />
            </span>
            Add members
          </DialogTitle>
          <DialogDescription>
            Add more of your connections to {groupName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-4">
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
              <Label htmlFor="add-members-search">Your connections</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="add-members-search"
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
                    ? "Everyone you're connected with is already in this group."
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
            <p className="text-xs text-muted-foreground">{selected.length} selected</p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isAdding || selected.length === 0}>
                {isAdding ? "Adding…" : "Add to group"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
