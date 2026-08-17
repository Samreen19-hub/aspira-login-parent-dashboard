"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { FEED_POSTS, type FeedPost } from "@/lib/parent-data"

type FeedStoreValue = { posts: FeedPost[]; savedIds: string[]; toggleSaved: (id: string) => void; removePost: (id: string) => void; addPost: (post: FeedPost) => void }
const FeedStoreContext = createContext<FeedStoreValue | null>(null)
const POSTS_KEY = "aspira-parent-feed-posts"
const SAVED_KEY = "aspira-parent-saved-post-ids"
const FOCUS_KEY = "aspira-parent-focus-post"

export function FeedStoreProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<FeedPost[]>(FEED_POSTS)
  const [savedIds, setSavedIds] = useState<string[]>([])
  useEffect(() => { try { const postsValue = localStorage.getItem(POSTS_KEY); const savedValue = localStorage.getItem(SAVED_KEY); if (postsValue) setPosts(JSON.parse(postsValue)); if (savedValue) setSavedIds(JSON.parse(savedValue)) } catch {} }, [])
  useEffect(() => { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)) }, [posts])
  useEffect(() => { localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)) }, [savedIds])
  const value = useMemo(() => ({ posts, savedIds, toggleSaved: (id: string) => setSavedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]), removePost: (id: string) => setPosts((items) => items.filter((item) => item.id !== id)), addPost: (post: FeedPost) => setPosts((items) => [post, ...items]) }), [posts, savedIds])
  return <FeedStoreContext.Provider value={value}>{children}</FeedStoreContext.Provider>
}
export function useFeedStore() { const value = useContext(FeedStoreContext); if (!value) throw new Error("useFeedStore must be used inside FeedStoreProvider"); return value }
export function focusPost(id: string) { sessionStorage.setItem(FOCUS_KEY, id) }
export function readPostFocus() { return sessionStorage.getItem(FOCUS_KEY) }
export function clearPostFocus() { sessionStorage.removeItem(FOCUS_KEY) }
export { FEED_POSTS }
