"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { FEED_POSTS, SPACE_FEED_POSTS, SEED_EVENTS, DEFAULT_RSVP, type FeedPost, type EventSource } from "@/lib/parent-data"
import type { Draft } from "@/components/parent/post-composer"

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
