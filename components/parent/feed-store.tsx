"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { FEED_POSTS, SPACE_FEED_POSTS, type FeedPost } from "@/lib/parent-data"
import type { Draft } from "@/components/parent/post-composer"

const INITIAL_POSTS: FeedPost[] = [...FEED_POSTS, ...SPACE_FEED_POSTS]

/** Builds a FeedPost from a composer draft. Shared by the Home Feed and group/community feeds. */
export function draftToPost(draft: Draft, opts: { author: string; role?: string; subtitle: string; avatar: string; scope?: string }): FeedPost {
  return {
    id: `post-${Date.now()}`,
    type: draft.type,
    author: opts.author,
    role: opts.role ?? "Parent",
    subtitle: opts.subtitle,
    time: "Just now",
    visibility: opts.scope ? (draft.type === "event" ? "Group" : "Public") : "Public",
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
    event: draft.event,
    scope: opts.scope,
  }
}

type FeedStoreValue = { posts: FeedPost[]; savedIds: string[]; toggleSaved: (id: string) => void; removePost: (id: string) => void; removePostsByScope: (scope: string) => void; addPost: (post: FeedPost) => void }
const FeedStoreContext = createContext<FeedStoreValue | null>(null)
const POSTS_KEY = "aspira-parent-feed-posts"
const SAVED_KEY = "aspira-parent-saved-post-ids"
const FOCUS_KEY = "aspira-parent-focus-post"

export function FeedStoreProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<FeedPost[]>(INITIAL_POSTS)
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { try { const postsValue = localStorage.getItem(POSTS_KEY); const savedValue = localStorage.getItem(SAVED_KEY); if (postsValue) { const stored: FeedPost[] = JSON.parse(postsValue); const storedIds = new Set(stored.map((post) => post.id)); const missingSeeds = SPACE_FEED_POSTS.filter((post) => !storedIds.has(post.id)); setPosts([...stored, ...missingSeeds]) } if (savedValue) setSavedIds(JSON.parse(savedValue)) } catch {} finally { setHydrated(true) } }, [])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(POSTS_KEY, JSON.stringify(posts)) }, [hydrated, posts])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)) }, [hydrated, savedIds])
  const value = useMemo(() => ({ posts, savedIds, toggleSaved: (id: string) => setSavedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]), removePost: (id: string) => { setPosts((items) => items.filter((item) => item.id !== id)); setSavedIds((ids) => ids.filter((value) => value !== id)) }, removePostsByScope: (scope: string) => { const removedIds = new Set(posts.filter((post) => post.scope === scope).map((post) => post.id)); setPosts((items) => items.filter((item) => item.scope !== scope)); setSavedIds((ids) => ids.filter((id) => !removedIds.has(id))) }, addPost: (post: FeedPost) => setPosts((items) => [post, ...items]) }), [posts, savedIds])
  return <FeedStoreContext.Provider value={value}>{children}</FeedStoreContext.Provider>
}
export function useFeedStore() { const value = useContext(FeedStoreContext); if (!value) throw new Error("useFeedStore must be used inside FeedStoreProvider"); return value }
export function focusPost(id: string) { sessionStorage.setItem(FOCUS_KEY, id) }
export function readPostFocus() { return sessionStorage.getItem(FOCUS_KEY) }
export function clearPostFocus() { sessionStorage.removeItem(FOCUS_KEY) }
export { FEED_POSTS }
