"use client"

import { CalendarDays, Clock3, MapPin, Users, Star, Share2 } from "lucide-react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EventView } from "@/lib/events"
import type { EventSource } from "@/lib/parent-data"
import type { RsvpState } from "@/components/parent/feed-store"

const SOURCE_TONE: Record<EventSource, string> = {
  school: "bg-violet-100 text-violet-700",
  group: "bg-blue-100 text-blue-700",
  community: "bg-pink-100 text-pink-700",
  connections: "bg-amber-100 text-amber-700",
  private: "bg-amber-100 text-amber-700",
}

export function EventCard({
  event,
  rsvp,
  onOpen,
  onToggleInterested,
  onShare,
}: {
  event: EventView
  rsvp?: RsvpState
  onOpen: () => void
  onToggleInterested: () => void
  onShare: () => void
}) {
  const interested = rsvp === "interested" || rsvp === "going"
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        {event.cover ? (
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-secondary sm:h-24 sm:w-36">
            <Image src={event.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
          </div>
        ) : (
          <div className="grid h-28 w-full shrink-0 place-items-center rounded-xl bg-brand-muted text-brand sm:h-24 sm:w-36" aria-hidden="true">
            <div className="text-center">
              <CalendarDays className="mx-auto size-6" />
              <p className="mt-1 text-xs font-semibold">{event.dateLabel}</p>
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`border-0 text-[11px] font-semibold ${SOURCE_TONE[event.source]}`}>{event.sourceLabel}</Badge>
            {event.spaceTitle && <span className="truncate text-xs font-medium text-muted-foreground">{event.spaceTitle}</span>}
            {event.isPast && <Badge variant="outline" className="text-[11px] text-muted-foreground">Past</Badge>}
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold text-foreground text-balance">{event.title}</h3>
          <div className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4 shrink-0 text-brand" />{event.dateLabel}</span>
            <span className="flex items-center gap-1.5"><Clock3 className="size-4 shrink-0 text-brand" />{event.timeLabel}</span>
            <span className="flex items-center gap-1.5"><MapPin className="size-4 shrink-0 text-brand" /><span className="truncate">{event.location}</span></span>
            <span className="flex items-center gap-1.5"><Users className="size-4 shrink-0 text-brand" /><span className="truncate">{event.organizer}</span></span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" className="rounded-lg" onClick={onOpen}>View details</Button>
            {!event.isPast && (
              <Button size="sm" variant={interested ? "secondary" : "outline"} className="gap-1.5 rounded-lg" onClick={onToggleInterested} aria-pressed={interested}>
                <Star className={`size-4 ${interested ? "fill-current text-brand" : ""}`} />
                {interested ? "Interested" : "Mark interested"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={onShare}>
              <Share2 className="size-4" />
              <span className="sr-only sm:not-sr-only">Share</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
