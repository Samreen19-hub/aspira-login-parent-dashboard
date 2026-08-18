"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { useFeedStore, readPostFocus, clearPostFocus, draftToPost } from "@/components/parent/feed-store"

export function HomeFeed({ childId }: { childId?: string }) {
  const { posts, addPost, removePost } = useFeedStore()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  useEffect(() => { const id = readPostFocus() || searchParams.get("post"); if (!id) return; const timer = window.setTimeout(() => { document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); setFocusedId(id); clearPostFocus(); window.setTimeout(() => setFocusedId(null), 2200) }, 150); return () => window.clearTimeout(timer) }, [searchParams])
  function handlePost(draft: Draft) { addPost(draftToPost(draft, { author: "Rashi Kapoor", subtitle: "Parent of Aarav Kapoor · Class 6, Greenfield Public School", avatar: "/avatar-rashi.png" })) }
  const homePosts = posts.filter((post) => !post.scope)
  const visiblePosts = childId ? homePosts.filter((post) => post.subtitle.toLowerCase().includes(childId) || post.body.toLowerCase().includes(childId)) : homePosts
  return <div className="flex flex-col gap-5"><PostComposer onPost={handlePost} />{visiblePosts.map((post) => <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onRemove={() => removePost(post.id)} /></div>)}</div>
}
