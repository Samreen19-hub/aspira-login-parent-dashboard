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
import type { RsvpState } from "@/components/parent/feed-store"

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
  rsvp,
  onSetRsvp,
  onShare,
  onDelete,
  onSaveEdit,
}: {
  view: EventView | null
  detail?: EventDetails
  open: boolean
  onOpenChange: (open: boolean) => void
  rsvp?: RsvpState
  onSetRsvp: (state: RsvpState | null) => void
  onShare: () => void
  onDelete: () => void
  onSaveEdit: (patch: Partial<EventDetails>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: "", date: "", time: "", endTime: "", location: "", description: "" })
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
    if (form.endTime <= form.time) {
      setError("End time must be after the start time.")
      return
    }
    onSaveEdit({
      title: form.title.trim(),
      isoDate: form.date,
      date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${form.date}T12:00:00`)),
      time: to12(form.time),
      endTime: to12(form.endTime),
      location: form.location.trim(),
      description: form.description.trim(),
    })
    setEditing(false)
  }

  const going = rsvp === "going"
  const interested = rsvp === "interested"

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
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" min={minDate} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
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
              <Detail icon={Users} label={`${view.attendees} interested`} />
              <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground text-pretty">{view.description}</p>

              {view.attendeeNames.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {view.attendeeNames.map((name) => (
                      <Avatar key={name} className="size-8 ring-2 ring-card">
                        <AvatarFallback className="bg-brand-muted text-xs font-semibold text-brand">{initialsOf(name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">and others</span>
                </div>
              )}
            </div>

            {!view.isPast && (
              <div className="flex flex-wrap gap-2">
                <Button variant={going ? "default" : "outline"} className="gap-1.5" onClick={() => onSetRsvp(going ? null : "going")} aria-pressed={going}>
                  <Check className="size-4" />Going
                </Button>
                <Button variant={interested ? "secondary" : "outline"} className="gap-1.5" onClick={() => onSetRsvp(interested ? null : "interested")} aria-pressed={interested}>
                  <Star className={`size-4 ${interested ? "fill-current text-brand" : ""}`} />Interested
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
