"use client"

import { useState } from "react"
import { PostComposer } from "@/components/parent/post-composer"
import { PostCard } from "@/components/parent/post-card"
import { FEED_POSTS, type FeedPost } from "@/lib/parent-data"

export function HomeFeed() {
  const [posts, setPosts] = useState<FeedPost[]>(FEED_POSTS)

  function handlePost(draft: { body: string; image?: string; hashtags?: string[] }) {
    const newPost: FeedPost = {
      id: `post-${Date.now()}`, author: "Rashi Kapoor", role: "Parent",
      subtitle: "Parent of Aarav Kapoor  ·  Class 6, Greenfield Public School",
      time: "Just now", visibility: "Public", avatar: "/avatar-rashi.png", body: draft.body,
      image: draft.image, hashtags: draft.hashtags ?? [], likes: 0, shares: 0,
      likedByLabel: "Be the first to react", comments: [],
    }
    setPosts((prev) => [newPost, ...prev])
  }

  return (
    <div className="space-y-5">
      <PostComposer onPost={handlePost} />
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
