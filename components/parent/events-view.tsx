"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarPlus, CalendarX2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useFeedStore, draftToPost, type RsvpState } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"
import { PostComposer, type Draft, type EventDestination } from "@/components/parent/post-composer"
import { EventCard } from "@/components/parent/event-card"
import { EventDetailsDialog } from "@/components/parent/event-details-dialog"
import { toEventView, type EventView, type Membership } from "@/lib/events"
import { CURRENT_PARENT, type EventDetails, type EventSource, type FeedPost } from "@/lib/parent-data"

type FilterKey = "all" | "school" | "group" | "community" | "mine"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "school", label: "School" },
  { key: "group", label: "Groups" },
  { key: "community", label: "Communities" },
  { key: "mine", label: "My events" },
]

function matchesFilter(event: EventView, filter: FilterKey) {
  if (filter === "all") return true
  if (filter === "mine") return event.isMine
  if (filter === "group") return event.source === "group"
  if (filter === "community") return event.source === "community"
  if (filter === "school") return event.source === "school"
  return true
}

export function EventsView() {
  const { posts, addPost, updatePost, removePost, rsvp, setRsvp } = useFeedStore()
  const social = useSocialStore()

  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Transient inline confirmation (announced to screen readers). Auto-clears after a few seconds.
  function notify(message: string) {
    setStatus(message)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(""), 3500)
  }
  useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current) }, [])

  const membership = useMemo<Membership>(
    () => ({ joined: social.joined, following: social.following, isAdmin: social.isAdmin, getSpace: social.getSpace }),
    [social.joined, social.following, social.isAdmin, social.getSpace],
  )

  // Recompute the visible event set whenever posts or membership change. Membership is the single
  // source of truth for who sees group/community events, so joining a space reveals its events here.
  const events = useMemo(() => {
    const now = new Date()
    return posts
      .map((post) => toEventView(post, membership, now))
      .filter((view): view is EventView => view !== null)
  }, [posts, membership])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter((event) => {
      if (!matchesFilter(event, filter)) return false
      if (!needle) return true
      return [event.title, event.location, event.organizer, event.spaceTitle ?? ""].some((field) => field.toLowerCase().includes(needle))
    })
  }, [events, filter, query])

  const upcoming = useMemo(() => filtered.filter((event) => !event.isPast).sort((a, b) => a.start.getTime() - b.start.getTime()), [filtered])
  const past = useMemo(() => filtered.filter((event) => event.isPast).sort((a, b) => b.start.getTime() - a.start.getTime()), [filtered])

  // Destinations offered when creating an event: personal, plus every group the parent has joined
  // and every community they follow (these are the only places a parent may post an event).
  const destinations = useMemo<EventDestination[]>(() => {
    const list: EventDestination[] = [{ value: "connections", label: "My connections" }]
    for (const slug of social.joined) {
      const space = social.getSpace(slug)
      if (space) list.push({ value: `group:${slug}`, label: space.title, group: "Group" })
    }
    for (const slug of social.following) {
      const space = social.getSpace(slug)
      if (space) list.push({ value: `community:${slug}`, label: space.title, group: "Community" })
    }
    return list
  }, [social.joined, social.following, social.getSpace])

  const openEvent = openId ? events.find((event) => event.id === openId) ?? null : null
  const openPost = openId ? posts.find((post) => post.id === openId) : undefined

  function handleCreate(draft: Draft) {
    if (draft.type !== "event" || !draft.event) return
    const destination = draft.event.destination ?? "connections"
    const [kind, slug] = destination.includes(":") ? destination.split(":") : ["connections", undefined]
    const source: EventSource = kind === "group" ? "group" : kind === "community" ? "community" : "connections"
    const space = slug ? social.getSpace(slug) : undefined
    const post = draftToPost(draft, {
      author: CURRENT_PARENT,
      role: "Parent",
      subtitle: space ? space.title : "My event",
      avatar: "/avatar-rashi.png",
      scope: slug,
      eventSource: source,
      eventOrganizer: space ? space.title : CURRENT_PARENT,
    })
    addPost(post)
    notify(`Event created: “${draft.event.title}” is now on your events.`)
  }

  function share(event: EventView) {
    const text = `${event.title} · ${event.dateLabel} ${event.timeLabel} · ${event.location}`
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {})
    }
    notify("Event details copied to your clipboard.")
  }

  function toggleInterested(event: EventView) {
    const current = rsvp[event.id]
    const next = current ? null : "interested"
    setRsvp(event.id, next)
    notify(next ? `Marked interested: ${event.title}` : `Removed interest: ${event.title}`)
  }

  function changeRsvp(event: EventView, state: RsvpState | null) {
    setRsvp(event.id, state)
    if (state) notify(`${state === "going" ? "You're going to" : "Marked interested:"} ${event.title}`)
    else notify(`RSVP cleared: ${event.title}`)
  }

  function saveEdit(post: FeedPost, patch: Partial<EventDetails>) {
    updatePost(post.id, { event: { ...(post.event as EventDetails), ...patch } })
    notify(`Event updated: ${patch.title ?? post.event?.title}`)
  }

  function deleteEvent(event: EventView) {
    removePost(event.id)
    setOpenId(null)
    notify(`Event deleted: ${event.title}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events" className="pl-9" aria-label="Search events" />
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter events by source">
          {FILTERS.map((option) => (
            <Button
              key={option.key}
              role="tab"
              aria-selected={filter === option.key}
              size="sm"
              variant={filter === option.key ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-2">
        <PostComposer onPost={handleCreate} eventDestinations={destinations} initialMode="event" />
      </div>

      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="upcoming-heading" className="font-display text-lg font-semibold text-foreground">Upcoming</h2>
          <span className="text-sm text-muted-foreground">{upcoming.length} event{upcoming.length === 1 ? "" : "s"}</span>
        </div>
        {upcoming.length > 0 ? (
          <div className="grid gap-4">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} rsvp={rsvp[event.id]} onOpen={() => setOpenId(event.id)} onToggleInterested={() => toggleInterested(event)} onShare={() => share(event)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={query || filter !== "all" ? CalendarX2 : CalendarPlus}
            title={query || filter !== "all" ? "No matching events" : "No upcoming events yet"}
            body={query || filter !== "all" ? "Try a different filter or search term." : "Create an event above, or join groups and communities to see their events here."}
          />
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="space-y-3">
          <h2 id="past-heading" className="font-display text-lg font-semibold text-foreground">Past events</h2>
          <div className="grid gap-4">
            {past.map((event) => (
              <EventCard key={event.id} event={event} rsvp={rsvp[event.id]} onOpen={() => setOpenId(event.id)} onToggleInterested={() => toggleInterested(event)} onShare={() => share(event)} />
            ))}
          </div>
        </section>
      )}

      <EventDetailsDialog
        view={openEvent}
        detail={openPost?.event}
        open={openId !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
        rsvp={openEvent ? rsvp[openEvent.id] : undefined}
        onSetRsvp={(state) => openEvent && changeRsvp(openEvent, state)}
        onShare={() => openEvent && share(openEvent)}
        onDelete={() => openEvent && deleteEvent(openEvent)}
        onSaveEdit={(patch) => openPost && saveEdit(openPost, patch)}
      />
    </div>
  )
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <Card className="grid place-items-center gap-2 border-dashed p-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-muted text-brand">
        <Icon className="size-6" />
      </span>
      <h3 className="font-display font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">{body}</p>
    </Card>
  )
}
