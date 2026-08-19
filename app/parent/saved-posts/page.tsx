"use client"

import Link from "next/link"
import { Bookmark, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PostCard } from "@/components/parent/post-card"
import { PageShell } from "@/components/parent/page-shell"
import { focusPost, useFeedStore } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"

export default function SavedPostsPage() {
  const { posts, savedIds } = useFeedStore()
  const { getSpace } = useSocialStore()
  /**
   * Resolve where a saved post should open, based on its persisted scope (the space slug).
   * Reads from the social store so it resolves BOTH seeded and user-created groups/communities.
   * No scope (or an unknown/removed space) falls back to the Home Feed, preserving legacy behavior.
   */
  const destinationFor = (scope?: string) => {
    if (!scope) return "/parent"
    const space = getSpace(scope)
    if (!space) return "/parent"
    return `/parent/${space.kind}/${space.slug}`
  }
  const savedPosts = [...savedIds].reverse().map((id) => posts.find((post) => post.id === id)).filter(Boolean)
  return <PageShell title="Saved Posts" description="Keep important updates close at hand." icon={Bookmark}>
    {savedPosts.length ? <div className="flex flex-col gap-5">{savedPosts.map((post) => post && <PostCard key={post.id} post={post} savedView onOpen={() => { focusPost(post.id); window.location.href = destinationFor(post.scope) }} />)}</div> : <Card className="border-dashed"><CardHeader className="items-center text-center"><span className="grid size-14 place-items-center rounded-full bg-brand-muted text-brand"><Bookmark className="size-7" /></span><CardTitle className="font-display text-xl">No saved posts yet</CardTitle></CardHeader><CardContent className="flex flex-col items-center gap-4 text-center"><p className="text-sm text-muted-foreground">Save posts from your Home Feed to find them here.</p><Button render={<Link href="/parent" />} className="rounded-xl">Explore Home Feed <ArrowRight data-icon="inline-end" /></Button></CardContent></Card>}
  </PageShell>
}
