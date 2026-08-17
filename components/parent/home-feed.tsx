"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { useFeedStore, readPostFocus, clearPostFocus } from "@/components/parent/feed-store"
import type { FeedPost } from "@/lib/parent-data"

export function HomeFeed({ childId }: { childId?: string }) {
  const { posts, addPost, removePost } = useFeedStore()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  useEffect(() => { const id = readPostFocus() || searchParams.get("post"); if (!id) return; const timer = window.setTimeout(() => { document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setFocusedId(id); clearPostFocus(); window.setTimeout(() => setFocusedId(null), 2200) }, 150); return () => window.clearTimeout(timer) }, [searchParams])
  function handlePost(draft: Draft) { const newPost: FeedPost = { id: `post-${Date.now()}`, type: draft.type, author: "Rashi Kapoor", role: "Parent", subtitle: "Parent of Aarav Kapoor · Class 6, Greenfield Public School", time: "Just now", visibility: "Public", avatar: "/avatar-rashi.png", body: draft.body, image: draft.image, hashtags: [], likes: 0, shares: 0, likedByLabel: "Be the first to react", comments: [], achievement: draft.achievement, poll: draft.poll ? { ...draft.poll, votes: draft.poll.options.map(() => 0) } : undefined, event: draft.event }; addPost(newPost) }
  const visiblePosts = childId ? posts.filter((post) => post.subtitle.toLowerCase().includes(childId) || post.body.toLowerCase().includes(childId)) : posts
  return <div className="flex flex-col gap-5"><PostComposer onPost={handlePost} />{visiblePosts.map((post) => <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onRemove={() => removePost(post.id)} /></div>)}</div>
}
