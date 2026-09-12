"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import useSWR from "swr"
import { FEED_POSTS, SPACE_FEED_POSTS, SEED_EVENTS, DEFAULT_RSVP, type FeedPost, type EventSource } from "@/lib/parent-data"
import type { Draft } from "@/components/parent/post-composer"
import { createPost, getFeed, type PostView } from "@/app/actions/posts"

const INITIAL_POSTS: FeedPost[] = [...FEED_POSTS, ...SPACE_FEED_POSTS, ...SEED_EVENTS]
/** Seeds re-added on hydration if a returning user's stored feed is missing them (scoped feeds + events). */
const MERGE_SEEDS: FeedPost[] = [...SPACE_FEED_POSTS, ...SEED_EVENTS]

export type RsvpState = "going" | "interested"

/** Builds a FeedPost from a composer draft. Shared by the Home Feed and group/community feeds. */
export function draftToPost(
  draft: Draft,
  opts: { author: string; role?: string; subtitle: string; avatar: string; scope?: string; eventSource?: EventSource; eventOrganizer?: string },
): FeedPost {
  return {
    id: `post-${Date.now()}`,
    type: draft.type,
    author: opts.author,
    role: opts.role ?? "Parent",
    subtitle: opts.subtitle,
    time: "Just now",
    visibility: draft.type === "event" ? eventVisibility(opts.eventSource) : opts.scope ? "Group" : "Public",
    avatar: opts.avatar,
    body: draft.body,
    image: draft.image,
    hashtags: [],
    likes: 0,
    shares: 0,
    likedByLabel: "Be the first to react",
    comments: [],
    achievement: draft.achievement,
    poll: draft.poll ? { ...draft.poll, votes: draft.poll.options.map(() => 0) } : undefined,
    event: draft.event
      ? {
          title: draft.event.title,
          date: draft.event.date,
          isoDate: draft.event.isoDate,
          time: draft.event.time,
          endTime: draft.event.endTime,
          location: draft.event.location,
          description: draft.event.description,
          cover: draft.event.cover,
          source: opts.eventSource,
          organizer: opts.eventOrganizer ?? opts.author,
        }
      : undefined,
    scope: opts.scope,
  }
}

function eventVisibility(source?: EventSource) {
  switch (source) {
    case "school":
      return "School"
    case "group":
      return "Group"
    case "community":
      return "Community"
    case "private":
      return "Only me"
    default:
      return "Connections"
  }
}

/** Relative "time ago" label for DB-backed posts (seed posts keep their own copy). */
function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "Just now"
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Builds the createPost() input from a composer draft. Presentation-only fields
 * (author name, subtitle, avatar, role, visibility) are stored in the JSONB
 * payload so the existing PostCard renders a DB post identically — but the
 * authoritative author id is set server-side from the session, never here.
 */
export function draftToCreateInput(
  draft: Draft,
  opts: { author: string; role?: string; subtitle: string; avatar: string; scope?: string; eventSource?: EventSource; eventOrganizer?: string },
) {
  const body = draft.type === "text" || draft.type === "photo" ? draft.body : ""
  return {
    type: draft.type,
    body,
    scope: opts.scope ?? null,
    payload: {
      author: opts.author,
      role: opts.role ?? "Parent",
      subtitle: opts.subtitle,
      avatar: opts.avatar,
      visibility: draft.type === "event" ? eventVisibility(opts.eventSource) : opts.scope ? "Group" : "Public",
      image: draft.type === "photo" ? draft.image : undefined,
      achievement: draft.achievement,
      poll: draft.poll ? { question: draft.poll.question, options: draft.poll.options } : undefined,
      event: draft.event
        ? {
            title: draft.event.title,
            date: draft.event.date,
            isoDate: draft.event.isoDate,
            time: draft.event.time,
            endTime: draft.event.endTime,
            location: draft.event.location,
            description: draft.event.description,
            cover: draft.event.cover,
            source: opts.eventSource,
            organizer: opts.eventOrganizer ?? opts.author,
          }
        : undefined,
    },
  }
}

/**
 * Creates a DB-backed post through the server action. Deliberately does NOT add
 * anything to the localStorage feed store, so a freshly created post shows up
 * exactly once — from the server feed — with no duplicate local copy.
 */
export async function createServerPost(
  draft: Draft,
  opts: { author: string; role?: string; subtitle: string; avatar: string; scope?: string; eventSource?: EventSource; eventOrganizer?: string },
) {
  return createPost(draftToCreateInput(draft, opts))
}

/** Converts a server PostView into the FeedPost shape the existing UI renders. */
export function postViewToFeedPost(view: PostView): FeedPost {
  const payload = (view.payload ?? {}) as Record<string, any>
  const options: string[] = payload.poll?.options ?? []
  const tally = view.pollTally ?? []
  return {
    id: view.id,
    type: view.type as FeedPost["type"],
    author: view.author.name ?? payload.author ?? "Parent",
    role: payload.role ?? "Parent",
    subtitle: payload.subtitle ?? "",
    time: relativeTime(view.createdAt),
    visibility: payload.visibility ?? "Public",
    avatar: view.author.avatar ?? payload.avatar ?? "/avatar-rashi.png",
    body: view.body ?? "",
    hashtags: [],
    image: typeof payload.image === "string" ? payload.image : undefined,
    likes: view.likeCount,
    comments: view.comments.map((c) => ({
      id: c.id,
      author: c.author.name ?? "Parent",
      avatar: c.author.avatar ?? "/avatar-rashi.png",
      text: c.body,
      time: relativeTime(c.createdAt),
    })),
    shares: 0,
    likedByLabel:
      view.likeCount > 0
        ? `${view.likeCount} ${view.likeCount === 1 ? "person likes this" : "people like this"}`
        : "Be the first to react",
    achievement: payload.achievement,
    poll: payload.poll
      ? { question: payload.poll.question ?? "", options, votes: options.map((_, i) => tally[i] ?? 0), voted: view.myVote ?? undefined }
      : undefined,
    event: payload.event,
    scope: view.scope ?? undefined,
    isMine: view.isMine,
  }
}

/**
 * Loads the DB-backed posts for a feed scope (null = Home feed) and maps them to
 * FeedPost. Used ALONGSIDE the existing seed/localStorage posts — it never
 * replaces them. Returns a `mutate` to refresh after creating a post.
 */
export function useServerFeed(scope?: string | null) {
  const { data, mutate } = useSWR(
    ["server-feed", scope ?? "__home__"],
    () => getFeed(scope ?? null),
    { revalidateOnFocus: false },
  )
  const posts = useMemo(() => (data ?? []).map(postViewToFeedPost), [data])
  return { posts, mutate }
}

type FeedStoreValue = {
  posts: FeedPost[]
  savedIds: string[]
  rsvp: Record<string, RsvpState>
  toggleSaved: (id: string) => void
  removePost: (id: string) => void
  removePostsByScope: (scope: string) => void
  addPost: (post: FeedPost) => void
  updatePost: (id: string, patch: Partial<FeedPost>) => void
  setRsvp: (id: string, state: RsvpState | null) => void
}
const FeedStoreContext = createContext<FeedStoreValue | null>(null)
const POSTS_KEY = "aspira-parent-feed-posts"
const SAVED_KEY = "aspira-parent-saved-post-ids"
const RSVP_KEY = "aspira-parent-event-rsvp"
const FOCUS_KEY = "aspira-parent-focus-post"

export function FeedStoreProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<FeedPost[]>(INITIAL_POSTS)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [rsvp, setRsvpState] = useState<Record<string, RsvpState>>(DEFAULT_RSVP)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { try { const postsValue = localStorage.getItem(POSTS_KEY); const savedValue = localStorage.getItem(SAVED_KEY); const rsvpValue = localStorage.getItem(RSVP_KEY); if (postsValue) { const stored: FeedPost[] = JSON.parse(postsValue); const storedIds = new Set(stored.map((post) => post.id)); const missingSeeds = MERGE_SEEDS.filter((post) => !storedIds.has(post.id)); setPosts([...stored, ...missingSeeds]) } if (savedValue) setSavedIds(JSON.parse(savedValue)); if (rsvpValue) setRsvpState(JSON.parse(rsvpValue)) } catch {} finally { setHydrated(true) } }, [])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(POSTS_KEY, JSON.stringify(posts)) }, [hydrated, posts])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)) }, [hydrated, savedIds])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(RSVP_KEY, JSON.stringify(rsvp)) }, [hydrated, rsvp])
  const value = useMemo(() => ({
    posts,
    savedIds,
    rsvp,
    toggleSaved: (id: string) => setSavedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]),
    removePost: (id: string) => { setPosts((items) => items.filter((item) => item.id !== id)); setSavedIds((ids) => ids.filter((value) => value !== id)) },
    removePostsByScope: (scope: string) => { const removedIds = new Set(posts.filter((post) => post.scope === scope).map((post) => post.id)); setPosts((items) => items.filter((item) => item.scope !== scope)); setSavedIds((ids) => ids.filter((id) => !removedIds.has(id))) },
    addPost: (post: FeedPost) => setPosts((items) => [post, ...items]),
    updatePost: (id: string, patch: Partial<FeedPost>) => setPosts((items) => items.map((item) => item.id === id ? { ...item, ...patch, event: patch.event ? { ...item.event, ...patch.event } : item.event } : item)),
    setRsvp: (id: string, state: RsvpState | null) => setRsvpState((current) => { const next = { ...current }; if (state) next[id] = state; else delete next[id]; return next }),
  }), [posts, savedIds, rsvp])
  return <FeedStoreContext.Provider value={value}>{children}</FeedStoreContext.Provider>
}
export function useFeedStore() { const value = useContext(FeedStoreContext); if (!value) throw new Error("useFeedStore must be used inside FeedStoreProvider"); return value }
export function focusPost(id: string) { sessionStorage.setItem(FOCUS_KEY, id) }
export function readPostFocus() { return sessionStorage.getItem(FOCUS_KEY) }
export function clearPostFocus() { sessionStorage.removeItem(FOCUS_KEY) }
export { FEED_POSTS }
