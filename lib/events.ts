import type { EventSource, FeedPost, SocialSpace } from "@/lib/parent-data"
import { CURRENT_PARENT } from "@/lib/parent-data"

/** A normalized, presentation-ready event derived from a feed post of type "event". */
export interface EventView {
  id: string
  title: string
  description: string
  location: string
  organizer: string
  cover?: string
  author: string
  avatar: string
  source: EventSource
  sourceLabel: string
  /** Group/community name and slug when the event belongs to a space. */
  spaceTitle?: string
  spaceSlug?: string
  /** DD/MM/YYYY. */
  dateLabel: string
  /** e.g. "8:00 AM – 10:00 AM". */
  timeLabel: string
  start: Date
  isPast: boolean
  isMine: boolean
  /** Whether the current parent may edit/delete this event. */
  canManage: boolean
  attendees: number
  attendeeNames: string[]
}

const SOURCE_LABELS: Record<EventSource, string> = {
  school: "School Event",
  group: "Group Event",
  community: "Community Event",
  connections: "My Event",
  private: "My Event",
}

/** Pads a two-digit value for DD/MM/YYYY output. */
function pad(value: number) {
  return String(value).padStart(2, "0")
}

/** Formats a Date as DD/MM/YYYY. */
export function formatDDMMYYYY(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Parses a display time such as "8:00 AM" or a 24h "14:30" into minutes since midnight. */
function parseTimeToMinutes(value?: string) {
  if (!value) return 0
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return 0
  let hour = Number(match[1])
  const minute = Number(match[2])
  const suffix = match[3]?.toUpperCase()
  if (suffix === "PM" && hour !== 12) hour += 12
  if (suffix === "AM" && hour === 12) hour = 0
  return hour * 60 + minute
}

/** Builds the start Date for sorting/classification from the event's ISO date (or display date) + time. */
function resolveStart(post: FeedPost): Date {
  const event = post.event!
  const base = event.isoDate ? new Date(`${event.isoDate}T00:00:00`) : new Date(event.date)
  if (Number.isNaN(base.getTime())) return new Date(0)
  const minutes = parseTimeToMinutes(event.time)
  base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return base
}

function normalizeTimeLabel(value?: string) {
  if (!value) return ""
  const minutes = parseTimeToMinutes(value)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${pad(minute)} ${suffix}`
}

/**
 * Resolves an event's source. Prefers the explicit `event.source`, then infers from the space it is
 * scoped to, then from the author. This keeps older seeded/created posts working without a source.
 */
export function resolveSource(post: FeedPost, space?: SocialSpace): EventSource {
  if (post.event?.source) return post.event.source
  if (space) return space.kind === "communities" ? "community" : "group"
  if (post.role === "School" || post.author.toLowerCase().includes("school")) return "school"
  if (post.author === CURRENT_PARENT) return "connections"
  return "connections"
}

/** Options describing the current parent's live membership, used to decide event visibility. */
export interface Membership {
  joined: string[]
  following: string[]
  isAdmin: (slug: string) => boolean
  getSpace: (slug: string) => SocialSpace | undefined
}

/**
 * Converts a feed post into an EventView and decides whether the current parent may see it.
 * Returns null for non-event posts and for events in spaces the parent has not joined/followed.
 * School events and the parent's own events are always visible.
 */
export function toEventView(post: FeedPost, membership: Membership, now: Date): EventView | null {
  if (post.type !== "event" || !post.event) return null
  const space = post.scope ? membership.getSpace(post.scope) : undefined
  const source = resolveSource(post, space)
  const isMine = post.author === CURRENT_PARENT

  // Membership-based visibility. Membership is the single source of truth (the social store).
  if (!isMine) {
    if (source === "group" && (!post.scope || !membership.joined.includes(post.scope))) return null
    if (source === "community" && (!post.scope || !membership.following.includes(post.scope))) return null
    if (source === "private") return null
  }

  const start = resolveStart(post)
  const isPast = start.getTime() < now.getTime()
  const spaceEditable = !!post.scope && membership.isAdmin(post.scope)
  const canManage = source !== "school" && (isMine || spaceEditable)
  const attendeeNames = space ? space.memberNames.slice(0, 4) : []
  const attendees = post.likes || attendeeNames.length

  return {
    id: post.id,
    title: post.event.title,
    description: post.event.description,
    location: post.event.location,
    organizer: post.event.organizer ?? space?.title ?? post.author,
    cover: post.event.cover,
    author: post.author,
    avatar: post.avatar,
    source,
    sourceLabel: isMine && (source === "connections" || source === "private") ? "My Event" : SOURCE_LABELS[source],
    spaceTitle: space?.title,
    spaceSlug: space?.slug,
    dateLabel: formatDDMMYYYY(start),
    timeLabel: post.event.endTime ? `${normalizeTimeLabel(post.event.time)} – ${normalizeTimeLabel(post.event.endTime)}` : normalizeTimeLabel(post.event.time),
    start,
    isPast,
    isMine,
    canManage,
    attendees,
    attendeeNames,
  }
}
