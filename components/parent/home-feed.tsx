"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { useFeedStore, readPostFocus, clearPostFocus, createServerPost, useServerFeed } from "@/components/parent/feed-store"
import { PostHiddenNotice } from "@/components/parent/post-hidden-notice"
import { deletePost, hidePost, unhidePost } from "@/app/actions/posts"

export function HomeFeed({ childId }: { childId?: string }) {
  const { posts, removePost } = useFeedStore()
  const { posts: serverPosts, mutate } = useServerFeed(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Id of the post just hidden via the DB-backed action, driving the temporary
  // "Post hidden" + Undo confirmation. Null when no confirmation is showing.
  const [hiddenNoticeId, setHiddenNoticeId] = useState<string | null>(null)
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
  // Hide/Delete wiring:
  //  - DB-backed posts hide/delete through the server actions, then revalidate
  //    the server feed. Delete is offered only to the author (post.isMine).
  //  - Seed/localStorage posts keep the existing local-only removal for BOTH
  //    Hide and Delete, so their behavior is unchanged.
  return <div className="flex flex-col gap-5"><PostComposer onPost={handlePost} />{hiddenNoticeId && <PostHiddenNotice onUndo={async () => { const id = hiddenNoticeId; setHiddenNoticeId(null); await unhidePost(id); await mutate() }} onDismiss={() => setHiddenNoticeId(null)} />}{visiblePosts.map((post) => {
    const isServer = serverIds.has(post.id)
    // DB-backed hide keeps its post_hides record, removes the post from this feed,
    // and shows the temporary Undo confirmation (Undo calls unhidePost + revalidate).
    const onHide = isServer ? async () => { await hidePost(post.id); await mutate(); setHiddenNoticeId(post.id) } : () => removePost(post.id)
    const onDelete = isServer ? (post.isMine ? async () => { await deletePost(post.id); await mutate() } : undefined) : () => removePost(post.id)
    return <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onHide={onHide} onDelete={onDelete} serverBacked={isServer} /></div>
  })}</div>
}
