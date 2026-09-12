"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { useFeedStore, readPostFocus, clearPostFocus, createServerPost, useServerFeed } from "@/components/parent/feed-store"

export function HomeFeed({ childId }: { childId?: string }) {
  const { posts, removePost } = useFeedStore()
  const { posts: serverPosts, mutate } = useServerFeed(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  useEffect(() => { const id = readPostFocus() || searchParams.get("post"); if (!id) return; const timer = window.setTimeout(() => { document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setFocusedId(id); clearPostFocus(); window.setTimeout(() => setFocusedId(null), 2200) }, 150); return () => window.clearTimeout(timer) }, [searchParams])
  async function handlePost(draft: Draft) {
    await createServerPost(draft, { author: "Rashi Kapoor", subtitle: "Parent of Aarav Kapoor · Class 6, Greenfield Public School", avatar: "/avatar-rashi.png" })
    await mutate()
  }
  // DB-backed posts (newest) shown above the existing seed/localStorage posts. IDs are distinct
  // UUIDs so there is never a duplicate with a seed or an older local post.
  const serverIds = new Set(serverPosts.map((post) => post.id))
  const homePosts = [...serverPosts, ...posts.filter((post) => !post.scope)]
  const visiblePosts = childId ? homePosts.filter((post) => post.subtitle.toLowerCase().includes(childId) || post.body.toLowerCase().includes(childId)) : homePosts
  return <div className="flex flex-col gap-5"><PostComposer onPost={handlePost} />{visiblePosts.map((post) => <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onRemove={serverIds.has(post.id) ? undefined : () => removePost(post.id)} /></div>)}</div>
}
