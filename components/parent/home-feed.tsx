"use client"

import { useState } from "react"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { FEED_POSTS, type FeedPost } from "@/lib/parent-data"

export function HomeFeed({ childId }: { childId?: string }) {
  const [posts, setPosts] = useState<FeedPost[]>(FEED_POSTS)
  const visiblePosts = childId ? posts.filter((post) => post.subtitle.toLowerCase().includes(childId) || post.body.toLowerCase().includes(childId)) : posts
  function handlePost(draft: Draft) {
    const newPost: FeedPost = { id: `post-${Date.now()}`, type: draft.type, author: "Rashi Kapoor", role: "Parent", subtitle: "Parent of Aarav Kapoor · Class 6, Greenfield Public School", time: "Just now", visibility: "Public", avatar: "/avatar-rashi.png", body: draft.body, image: draft.image, hashtags: [], likes: 0, shares: 0, likedByLabel: "Be the first to react", comments: [], achievement: draft.achievement, poll: draft.poll ? { ...draft.poll, votes: draft.poll.options.map(() => 0) } : undefined, event: draft.event }
    setPosts((prev) => [newPost, ...prev])
  }
  function removePost(id: string) {
    setPosts((current) => current.filter((post) => post.id !== id))
  }

  return <div className="flex flex-col gap-5"><PostComposer onPost={handlePost} />{visiblePosts.map((post) => <PostCard key={post.id} post={post} onRemove={() => removePost(post.id)} />)}</div>
}
