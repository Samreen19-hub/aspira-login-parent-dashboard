"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { CalendarDays, Clock3, MapPin, Users, Star, Share2, Pencil, Trash2, Check } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { EventView } from "@/lib/events"
import type { EventDetails } from "@/lib/parent-data"
import type { RsvpFlags } from "@/components/parent/feed-store"

function initialsOf(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("")
}

function todayInputValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset()
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

/** Converts a display time ("8:00 AM") into a 24h input value ("08:00"). */
function displayTo24(value?: string) {
  if (!value) return ""
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return ""
  let hour = Number(match[1])
  const minute = match[2]
  const suffix = match[3]?.toUpperCase()
  if (suffix === "PM" && hour !== 12) hour += 12
  if (suffix === "AM" && hour === 12) hour = 0
  return `${String(hour).padStart(2, "0")}:${minute}`
}

function to12(value: string) {
  if (!value) return ""
  const [h, m] = value.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
}

export function EventDetailsDialog({
  view,
  detail,
  open,
  onOpenChange,
  going,
  interested,
  onSetRsvp,
  onShare,
  onDelete,
  onSaveEdit,
}: {
  view: EventView | null
  detail?: EventDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  going: boolean
  interested: boolean
  onSetRsvp: (flags: RsvpFlags) => void
  onShare: () => void
  onDelete: () => void
  onSaveEdit: (patch: Partial<EventDetails>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: "", date: "", endDate: "", time: "", endTime: "", location: "", description: "" })
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setEditing(false)
      setError("")
    }
  }, [open])

  useEffect(() => {
    if (editing && detail) {
      setForm({
        title: detail.title,
        date: detail.isoDate ?? "",
        endDate: detail.endDate ?? detail.isoDate ?? "",
        time: displayTo24(detail.time),
        endTime: displayTo24(detail.endTime),
        location: detail.location,
        description: detail.description,
      })
      setError("")
    }
  }, [editing, detail])

  if (!view) return null

  const minDate = todayInputValue()

  function save() {
    if (!form.title.trim() || !form.date || !form.time || !form.endTime || !form.location.trim()) {
      setError("Please complete every field.")
      return
    }
    if (form.date < minDate) {
      setError("Please select a future date for the event.")
      return
    }
    const endDate = form.endDate || form.date
    if (endDate < form.date) {
      setError("End date can't be before the start date.")
      return
    }
    if (endDate === form.date && form.endTime <= form.time) {
      setError("End time must be after the start time.")
      return
    }
    onSaveEdit({
      title: form.title.trim(),
      isoDate: form.date,
      endDate,
      date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${form.date}T12:00:00`)),
      time: to12(form.time),
      endTime: to12(form.endTime),
      location: form.location.trim(),
      description: form.description.trim(),
    })
    setEditing(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit event</DialogTitle>
              <DialogDescription>Update the details of your event.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Event title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Start date</Label>
                  <Input type="date" min={minDate} value={form.date} onChange={(e) => setForm((f) => { const value = e.target.value; return { ...f, date: value, endDate: !f.endDate || f.endDate < value ? value : f.endDate } })} />
                </div>
                <div className="grid gap-2">
                  <Label>End date</Label>
                  <Input type="date" min={form.date || minDate} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Start time</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>End time</Label>
                  <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={save}>Save changes</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <Badge className="w-fit border-0 bg-brand-muted text-[11px] font-semibold text-brand">{view.sourceLabel}</Badge>
              <DialogTitle className="text-balance">{view.title}</DialogTitle>
              <DialogDescription>{view.spaceTitle ? `${view.spaceTitle} · ` : ""}Organized by {view.organizer}</DialogDescription>
            </DialogHeader>

            {view.cover && (
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-secondary">
                <Image src={view.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
              </div>
            )}

            <div className="grid gap-3">
              <Detail icon={CalendarDays} label={view.dateLabel} />
              <Detail icon={Clock3} label={view.timeLabel} />
              <Detail icon={MapPin} label={view.location} />
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground text-pretty">{view.description}</p>

              {/* Going and Interested are two INDEPENDENT entities: each list shows
                  its own total and its own participants, resolved separately from
                  the DB. The same person can appear in both, and neither total is
                  ever derived from the other. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <ParticipantList icon={Check} label="Going" count={view.goingCount} names={view.goingNames} />
                <ParticipantList icon={Star} label="Interested" count={view.interestedCount} names={view.interestedNames} />
              </div>
            </div>

            {!view.isPast && (
              <div className="flex flex-wrap gap-2">
                <Button variant={going ? "default" : "outline"} className="gap-1.5" onClick={() => onSetRsvp({ going: !going, interested })} aria-pressed={going}>
                  <Check className="size-4" />Going
                  <span className="tabular-nums font-semibold">{view.goingCount}</span>
                </Button>
                <Button variant={interested ? "secondary" : "outline"} className="gap-1.5" onClick={() => onSetRsvp({ going, interested: !interested })} aria-pressed={interested}>
                  <Star className={`size-4 ${interested ? "fill-current text-brand" : ""}`} />Interested
                  <span className="tabular-nums font-semibold">{view.interestedCount}</span>
                </Button>
                <Button variant="outline" className="gap-1.5" onClick={onShare}>
                  <Share2 className="size-4" />Share
                </Button>
              </div>
            )}

            {view.canManage && (
              <DialogFooter className="border-t border-border pt-4">
                <Button variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" />Edit
                </Button>
                <Button variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="size-4" />Delete
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Detail({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/**
 * One independent RSVP roster (Going OR Interested). Its `count` and `names`
 * are passed in already resolved for that single entity, so this never mixes
 * or derives one list from the other — the same person may appear in both the
 * Going and Interested lists rendered side by side.
 */
function ParticipantList({
  icon: Icon,
  label,
  count,
  names,
}: {
  icon: React.ElementType
  label: string
  count: number
  names: string[]
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
        <span>
          {label}: <span className="tabular-nums">{count}</span>
        </span>
      </div>
      {names.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {names.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="size-6">
                <AvatarFallback className="bg-brand-muted text-[10px] font-semibold text-brand">{initialsOf(name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No one yet</p>
      )}
    </div>
  )
}
