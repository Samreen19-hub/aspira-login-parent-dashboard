"use client"

import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RsvpState } from "@/components/parent/feed-store"

/**
 * The shared Going / Interested control with live DB counts. Rendering it in the
 * Home Feed event card, the Events page card, and the View Details dialog keeps
 * the RSVP state and counts identical across all three surfaces — there is a
 * single source of truth (the EventView, backed by public.event_rsvps).
 */
export function EventRsvpBar({
  rsvp,
  goingCount,
  interestedCount,
  onSetRsvp,
  size = "default",
}: {
  rsvp?: RsvpState
  goingCount: number
  interestedCount: number
  onSetRsvp: (state: RsvpState | null) => void
  size?: "sm" | "default"
}) {
  const going = rsvp === "going"
  const interested = rsvp === "interested"
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size={size}
        variant={going ? "default" : "outline"}
        className="gap-1.5 rounded-lg"
        onClick={() => onSetRsvp(going ? null : "going")}
        aria-pressed={going}
      >
        <Check className="size-4" />
        Going
        <span className="tabular-nums font-semibold">{goingCount}</span>
      </Button>
      <Button
        size={size}
        variant={interested ? "secondary" : "outline"}
        className="gap-1.5 rounded-lg"
        onClick={() => onSetRsvp(interested ? null : "interested")}
        aria-pressed={interested}
      >
        <Star className={`size-4 ${interested ? "fill-current text-brand" : ""}`} />
        Interested
        <span className="tabular-nums font-semibold">{interestedCount}</span>
      </Button>
    </div>
  )
}
