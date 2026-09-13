"use client"

import { Check, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RsvpFlags } from "@/components/parent/feed-store"

/**
 * The shared Going / Interested control with live DB counts. Rendering it in the
 * Home Feed event card, the Events page card, and the View Details dialog keeps
 * the RSVP state and counts identical across all three surfaces — there is a
 * single source of truth (the EventView, backed by public.event_rsvps).
 *
 * Going and Interested are INDEPENDENT toggles: clicking one flips only that
 * flag and leaves the other untouched, so a user can be both Going AND
 * Interested at the same time. Each callback reports the full desired flag pair.
 */
export function EventRsvpBar({
  going,
  interested,
  goingCount,
  interestedCount,
  onSetRsvp,
  size = "default",
}: {
  going: boolean
  interested: boolean
  goingCount: number
  interestedCount: number
  onSetRsvp: (flags: RsvpFlags) => void
  size?: "sm" | "default"
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size={size}
        variant={going ? "default" : "outline"}
        className="gap-1.5 rounded-lg"
        onClick={() => onSetRsvp({ going: !going, interested })}
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
        onClick={() => onSetRsvp({ going, interested: !interested })}
        aria-pressed={interested}
      >
        <Star className={`size-4 ${interested ? "fill-current text-brand" : ""}`} />
        Interested
        <span className="tabular-nums font-semibold">{interestedCount}</span>
      </Button>
    </div>
  )
}
