"use client"

import Link from "next/link"
import useSWR from "swr"
import { Bookmark, ArrowRight, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PostCard } from "@/components/parent/post-card"
import { PageShell } from "@/components/parent/page-shell"
import { focusPost, useFeedStore, postViewToFeedPost } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"
import { getPostsByIds, unhidePost } from "@/app/actions/posts"

export default function SavedPostsPage() {
  const { posts, savedIds } = useFeedStore()
  const { getSpace } = useSocialStore()
  /**
   * Saved ids that aren't among the seed/localStorage posts are DB-backed posts
   * (UUIDs). Resolve those from the server so they render here too; seed/old
   * saved posts keep resolving from the local feed exactly as before. This adds
   * no new saved-post storage — the saved-id list itself is unchanged.
   */
  const localIds = new Set(posts.map((post) => post.id))
  const dbIds = savedIds.filter((id) => !localIds.has(id))
  const { data: dbViews, mutate: mutateDbViews } = useSWR(
    dbIds.length ? ["saved-db-posts", [...dbIds].sort().join(",")] : null,
    () => getPostsByIds(dbIds),
    { revalidateOnFocus: false },
  )
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
  const byId = new Map(posts.map((post) => [post.id, post]))
  for (const view of dbViews ?? []) byId.set(view.id, postViewToFeedPost(view))
  const savedPosts = [...savedIds].reverse().map((id) => byId.get(id)).filter(Boolean)
  return <PageShell title="Saved Posts" description="Keep important updates close at hand." icon={Bookmark}>
    {savedPosts.length ? <div className="flex flex-col gap-5">{savedPosts.map((post) => post && (post.hiddenByMe ? (
      // A saved post the user has hidden stays in this list; surface the hidden
      // state with an inline Unhide that clears the post_hides marker, then
      // revalidate so it renders as a normal saved post again.
      <Card key={post.id} className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-muted text-brand"><EyeOff className="size-5" /></span>
          <p className="flex-1 text-sm text-muted-foreground">This post is hidden from your feed.</p>
          <Button className="rounded-xl" onClick={async () => { await unhidePost(post.id); await mutateDbViews() }}>Unhide</Button>
        </CardContent>
      </Card>
    ) : <PostCard key={post.id} post={post} savedView onOpen={() => { focusPost(post.id); window.location.href = destinationFor(post.scope) }} />))}</div> : <Card className="border-dashed"><CardHeader className="items-center text-center"><span className="grid size-14 place-items-center rounded-full bg-brand-muted text-brand"><Bookmark className="size-7" /></span><CardTitle className="font-display text-xl">No saved posts yet</CardTitle></CardHeader><CardContent className="flex flex-col items-center gap-4 text-center"><p className="text-sm text-muted-foreground">Save posts from your Home Feed to find them here.</p><Button render={<Link href="/parent" />} className="rounded-xl">Explore Home Feed <ArrowRight data-icon="inline-end" /></Button></CardContent></Card>}
  </PageShell>
}
