"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { CalendarX2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useFeedStore, createServerPost, useVisibleEvents, type RsvpFlags } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"
import { PostComposer, type Draft, type EventDestination } from "@/components/parent/post-composer"
import { EventCard } from "@/components/parent/event-card"
import { EventDetailsDialog } from "@/components/parent/event-details-dialog"
import { toEventView, type EventView, type Membership } from "@/lib/events"
import { CURRENT_PARENT, type EventDetails, type EventSource } from "@/lib/parent-data"
import { cn } from "@/lib/utils"

type FilterKey = "all" | "school" | "group" | "community" | "mine"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "school", label: "School" },
  { key: "group", label: "Groups" },
  { key: "community", label: "Communities" },
  { key: "mine", label: "My events" },
]

/** Splits a list into upcoming (nearest first) and past (most recent first). */
function splitByTime(list: EventView[]) {
  const upcoming = list.filter((e) => !e.isPast).sort((a, b) => a.start.getTime() - b.start.getTime())
  const past = list.filter((e) => e.isPast).sort((a, b) => b.start.getTime() - a.start.getTime())
  return { upcoming, past }
}

/** Orders a list upcoming-first (nearest date), then past events (most recent first). */
function orderByTime(list: EventView[]) {
  const { upcoming, past } = splitByTime(list)
  return [...upcoming, ...past]
}

export function EventsView() {
  const { posts, updatePost, removePost, rsvp, setRsvp } = useFeedStore()
  const social = useSocialStore()
  // DB-backed events across every source the parent can see (their Home events
  // plus events in joined groups / followed communities) — all from the same
  // public.posts pipeline the Home feed uses. Newly created event posts appear
  // here through this feed, never a separate local store.
  const eventScopes = useMemo(() => [...social.joined, ...social.following], [social.joined, social.following])
  const { posts: serverPosts, mutate: mutateFeed, setRsvpOptimistic } = useVisibleEvents(eventScopes)

  // Server events surface alongside the existing seed/local posts. IDs never
  // collide (server UUIDs vs. seed/`post-` ids), so a plain concat is safe.
  const allPosts = useMemo(() => [...serverPosts, ...posts], [serverPosts, posts])
  const serverIds = useMemo(() => new Set(serverPosts.map((post) => post.id)), [serverPosts])

  // RSVP display prefers the server-persisted flags for DB-backed events and
  // falls back to the existing local RSVP map for seed/local events. Going and
  // Interested are independent, so each event carries both flags.
  const rsvpView = useMemo(() => {
    const merged: Record<string, RsvpFlags> = { ...rsvp }
    for (const post of serverPosts) {
      if (post.type === "event" && (post.myGoing || post.myInterested)) {
        merged[post.id] = { going: Boolean(post.myGoing), interested: Boolean(post.myInterested) }
      }
    }
    return merged
  }, [rsvp, serverPosts])

  const [filter, setFilter] = useState<FilterKey>("all")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const statusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const openComposer = useRef<() => void>(() => {})

  function notify(message: string) {
    setStatus(message)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus(""), 3200)
  }
  useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current) }, [])

  // Live membership is the single source of truth for group/community visibility.
  const membership = useMemo<Membership>(
    () => ({ joined: social.joined, following: social.following, isAdmin: social.isAdmin, getSpace: social.getSpace }),
    [social.joined, social.following, social.isAdmin, social.getSpace],
  )

  // Every event post the current parent can access, resolved to a view model.
  const events = useMemo(() => {
    const now = new Date()
    return allPosts
      .map((post) => toEventView(post, membership, now))
      .filter((view): view is EventView => view !== null)
  }, [allPosts, membership])

  const needle = query.trim().toLowerCase()
  const matchesQuery = useMemo(() => {
    return (event: EventView) => {
      if (!needle) return true
      return [event.title, event.location, event.organizer, event.spaceTitle ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      )
    }
  }, [needle])

  // Standard (source-based) filtering used by every tab except "My events".
  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (filter === "school") return event.source === "school" && matchesQuery(event)
      if (filter === "group") return event.source === "group" && matchesQuery(event)
      if (filter === "community") return event.source === "community" && matchesQuery(event)
      if (filter === "mine") return false
      return matchesQuery(event)
    })
  }, [events, filter, matchesQuery])

  const { upcoming, past } = useMemo(() => splitByTime(filtered), [filtered])

  // My events splits into what Rashi created vs. events she's attending / interested in.
  const mineCreated = useMemo(() => events.filter((e) => e.isMine && matchesQuery(e)), [events, matchesQuery])
  const mineAttending = useMemo(
    () => events.filter((e) => !e.isMine && rsvpView[e.id] && matchesQuery(e)),
    [events, rsvpView, matchesQuery],
  )

  // Where a new event can be shared: connections, any joined group, any followed community, or private.
  const destinations = useMemo<EventDestination[]>(() => {
    const list: EventDestination[] = [{ value: "connections", label: "My connections" }]
    social.joined.forEach((slug) => {
      const space = social.getSpace(slug)
      if (space) list.push({ value: `group:${slug}`, label: `Group · ${space.title}` })
    })
    social.following.forEach((slug) => {
      const space = social.getSpace(slug)
      if (space) list.push({ value: `community:${slug}`, label: `Community · ${space.title}` })
    })
    list.push({ value: "private", label: "Only me" })
    return list
  }, [social.joined, social.following, social.getSpace])

  const activeView = openId ? events.find((e) => e.id === openId) ?? null : null
  const activeDetail = openId ? allPosts.find((p) => p.id === openId)?.event : undefined

  async function handleCreate(draft: Draft) {
    const destination = draft.event?.destination ?? "connections"
    let source: EventSource = "connections"
    let slug: string | undefined
    if (destination === "private") {
      source = "private"
    } else if (destination.includes(":")) {
      const [kind, spaceSlug] = destination.split(":")
      slug = spaceSlug
      source = kind === "group" ? "group" : kind === "community" ? "community" : "connections"
    }
    const space = slug ? social.getSpace(slug) : undefined
    const subtitle = space ? space.title : source === "private" ? "Private event" : "Shared with connections"
    // Create through the SAME DB-backed post action the Home Feed uses. The
    // authoritative author is the authenticated session user (set server-side);
    // the payload author/organizer below are only display fallbacks and are
    // overridden by the real creator in buildEventView for server events. This
    // is why the organizer is always the creator (Mujtaba/Samreen), never the
    // legacy CURRENT_PARENT, and why the event shows up in the Home Feed too.
    await createServerPost(draft, {
      author: CURRENT_PARENT,
      role: "Parent",
      subtitle,
      avatar: "/avatar-rashi.png",
      scope: slug,
      eventSource: source,
    })
    await mutateFeed()
    notify("Event created")
  }

  function handleSaveEdit(id: string, patch: Partial<EventDetails>) {
    // The feed store merges `event` patches onto the existing event details.
    updatePost(id, { event: patch as EventDetails })
    notify("Event updated")
  }

  function handleDelete(id: string) {
    removePost(id)
    setOpenId(null)
    notify("Event deleted")
  }

  function setInterest(event: EventView, flags: RsvpFlags) {
    const prev = rsvpView[event.id] ?? { going: false, interested: false }
    if (serverIds.has(event.id)) {
      // DB-backed event: Going and Interested are independent flags in
      // public.event_rsvps. The optimistic setter updates the shared cache
      // instantly (so the card and the details dialog move together), persists
      // via the setRsvp action, then revalidates to authoritative counts.
      void setRsvpOptimistic(event.id, flags.going, flags.interested)
    } else {
      setRsvp(event.id, flags)
    }
    // Announce only the flag that actually changed so the toast stays accurate
    // when a user holds both at once.
    if (flags.going !== prev.going) notify(flags.going ? "You're going" : "No longer going")
    else if (flags.interested !== prev.interested) notify(flags.interested ? "Marked as interested" : "No longer interested")
  }

  async function share(event: EventView) {
    const text = `${event.title} · ${event.dateLabel} · ${event.location}`
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: event.title, text })
        return
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        notify("Event details copied")
        return
      }
    } catch {
      /* user dismissed share sheet — no action needed */
      return
    }
    notify("Sharing isn't available on this device")
  }

  function renderGrid(list: EventView[]) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            going={Boolean(rsvpView[event.id]?.going)}
            interested={Boolean(rsvpView[event.id]?.interested)}
            onOpen={() => setOpenId(event.id)}
            onSetRsvp={(flags) => setInterest(event, flags)}
            onShare={() => share(event)}
          />
        ))}
      </div>
    )
  }

  function SectionHeading({ children, count }: { children: React.ReactNode; count: number }) {
    return (
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        {children}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{count}</span>
      </h2>
    )
  }

  const emptyCopy: Record<FilterKey, { title: string; body: string; action?: { label: string; href?: string; onClick?: () => void } }> = {
    all: {
      title: "No events yet",
      body: "Create an event above, or join groups and follow communities to see the events they host.",
      action: { label: "Create event", onClick: () => openComposer.current() },
    },
    school: { title: "No school events", body: "Events published by your school will appear here as soon as they're scheduled." },
    group: {
      title: "No group events",
      body: "Join a group to see the events its members organize.",
      action: { label: "Explore groups", href: "/parent/groups" },
    },
    community: {
      title: "No community events",
      body: "Follow a community to see the events it hosts.",
      action: { label: "Explore communities", href: "/parent/communities" },
    },
    mine: {
      title: "No events yet",
      body: "Create your first event, or RSVP to events to keep track of them here.",
      action: { label: "Create event", onClick: () => openComposer.current() },
    },
  }

  function EmptyState({ config }: { config: (typeof emptyCopy)[FilterKey] }) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <CalendarX2 className="size-7" />
        </span>
        <h3 className="font-display text-lg font-semibold text-foreground">{config.title}</h3>
        <p className="max-w-sm text-sm text-muted-foreground">{config.body}</p>
        {config.action &&
          (config.action.href ? (
            <Button className="mt-1 rounded-xl" render={<Link href={config.action.href} />}>
              {config.action.label}
            </Button>
          ) : (
            <Button className="mt-1 rounded-xl" onClick={config.action.onClick}>
              {config.action.label}
            </Button>
          ))}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Create-event composer (single-purpose on this page) */}
      <PostComposer
        onPost={handleCreate}
        eventDestinations={destinations}
        initialMode="event"
        registerOpen={(open) => {
          openComposer.current = open
        }}
      />

      {/* Search + source filters */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:max-w-xs md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            aria-label="Search events"
            className="h-10 rounded-xl pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter events by source">
          {FILTERS.map((item) => {
            const active = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(item.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Listing */}
      {filter === "mine" ? (
        mineCreated.length === 0 && mineAttending.length === 0 ? (
          <EmptyState config={emptyCopy.mine} />
        ) : (
          <div className="space-y-8">
            <section>
              <SectionHeading count={mineCreated.length}>Created by me</SectionHeading>
              {mineCreated.length > 0 ? (
                renderGrid(orderByTime(mineCreated))
              ) : (
                <p className="text-sm text-muted-foreground">You haven&apos;t created any events yet.</p>
              )}
            </section>
            <section>
              <SectionHeading count={mineAttending.length}>I&apos;m attending / interested</SectionHeading>
              {mineAttending.length > 0 ? (
                renderGrid(orderByTime(mineAttending))
              ) : (
                <p className="text-sm text-muted-foreground">RSVP to an event to see it here.</p>
              )}
            </section>
          </div>
        )
      ) : upcoming.length === 0 && past.length === 0 ? (
        <EmptyState config={emptyCopy[filter]} />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section>
              <SectionHeading count={upcoming.length}>Upcoming</SectionHeading>
              {renderGrid(upcoming)}
            </section>
          )}
          {past.length > 0 && (
            <section>
              <SectionHeading count={past.length}>Past</SectionHeading>
              {renderGrid(past)}
            </section>
          )}
        </div>
      )}

      <EventDetailsDialog
        view={activeView}
        detail={activeDetail}
        open={openId !== null}
        onOpenChange={(next) => !next && setOpenId(null)}
        going={activeView ? Boolean(rsvpView[activeView.id]?.going) : false}
        interested={activeView ? Boolean(rsvpView[activeView.id]?.interested) : false}
        onSetRsvp={(flags) => activeView && setInterest(activeView, flags)}
        onShare={() => activeView && share(activeView)}
        onSaveEdit={(patch) => activeView && handleSaveEdit(activeView.id, patch)}
        onDelete={() => activeView && handleDelete(activeView.id)}
      />

      {status && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg"
        >
          {status}
        </div>
      )}
    </div>
  )
}
