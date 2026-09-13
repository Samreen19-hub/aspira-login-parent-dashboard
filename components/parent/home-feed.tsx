"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PostComposer, type Draft } from "@/components/parent/post-composer"
import { PostCard, type EventRsvpControls } from "@/components/parent/post-card"
import { useFeedStore, readPostFocus, clearPostFocus, createServerPost, useServerFeed, type RsvpFlags } from "@/components/parent/feed-store"
import { useSocialStore } from "@/components/parent/social-store"
import { EventDetailsDialog } from "@/components/parent/event-details-dialog"
import { PostHiddenNotice } from "@/components/parent/post-hidden-notice"
import { buildEventView, type EventView } from "@/lib/events"
import type { EventDetails, FeedPost } from "@/lib/parent-data"
import { deletePost, hidePost, unhidePost, updateEventPost } from "@/app/actions/posts"

export function HomeFeed({ childId }: { childId?: string }) {
  const { posts, removePost, updatePost, rsvp, setRsvp } = useFeedStore()
  const { posts: serverPosts, mutate, setRsvpOptimistic } = useServerFeed(null)
  const social = useSocialStore()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  // Which Home Feed event has its details dialog open (reuses the Events page dialog).
  const [openEventId, setOpenEventId] = useState<string | null>(null)
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
  const serverIds = useMemo(() => new Set(serverPosts.map((post) => post.id)), [serverPosts])
  const homePosts = [...serverPosts, ...posts.filter((post) => !post.scope)]
  const visiblePosts = childId ? homePosts.filter((post) => post.subtitle.toLowerCase().includes(childId) || post.body.toLowerCase().includes(childId)) : homePosts

  // Single RSVP view model shared by the Home Feed event card AND its details
  // dialog: server-persisted flags win for DB-backed events (public.event_rsvps),
  // otherwise the existing local RSVP map is used. Going and Interested stay
  // independent, exactly as on the Events page.
  const rsvpView = useMemo(() => {
    const merged: Record<string, RsvpFlags> = { ...rsvp }
    for (const post of serverPosts) {
      if (post.type === "event" && (post.myGoing || post.myInterested)) {
        merged[post.id] = { going: Boolean(post.myGoing), interested: Boolean(post.myInterested) }
      }
    }
    return merged
  }, [rsvp, serverPosts])

  // Resolves an event post to the shared EventView (same builder the Events page
  // uses), so counts/dates/organizer are identical wherever the event appears.
  const now = useMemo(() => new Date(), [])
  function viewFor(post: FeedPost): EventView {
    const space = post.scope ? social.getSpace(post.scope) : undefined
    return buildEventView(post, { space, now })
  }

  // Applies an RSVP change through the existing pipeline: the optimistic setter
  // for DB-backed events (public.event_rsvps) and the local map for seed posts.
  function setInterest(post: FeedPost, flags: RsvpFlags) {
    if (serverIds.has(post.id)) void setRsvpOptimistic(post.id, flags.going, flags.interested)
    else setRsvp(post.id, flags)
  }

  // Reuses the Events page share behavior for the details dialog (native share
  // sheet, then clipboard fallback) — no new share implementation.
  async function shareEvent(event: EventView) {
    const text = `${event.title} · ${event.dateLabel} · ${event.location}`
    try {
      if (typeof navigator !== "undefined" && navigator.share) { await navigator.share({ title: event.title, text }); return }
      if (typeof navigator !== "undefined" && navigator.clipboard) { await navigator.clipboard.writeText(text); return }
    } catch {
      /* user dismissed the share sheet — no action needed */
    }
  }

  // Live RSVP + View Details controls for a Home Feed event card. Counts/flags
  // come from the shared view/rsvpView, and View Details opens the same
  // EventDetailsDialog used on the Events page.
  function eventControlsFor(post: FeedPost): EventRsvpControls {
    const view = viewFor(post)
    const flags = rsvpView[post.id] ?? { going: false, interested: false }
    return {
      going: flags.going,
      interested: flags.interested,
      goingCount: view.goingCount,
      interestedCount: view.interestedCount,
      isPast: view.isPast,
      onSetRsvp: (next) => setInterest(post, next),
      onOpenDetails: () => setOpenEventId(post.id),
    }
  }

  const activePost = openEventId ? homePosts.find((post) => post.id === openEventId) : undefined
  const activeView = activePost ? viewFor(activePost) : null
  const activeDetail = activePost?.event

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
    const eventRsvp = post.type === "event" && post.event ? eventControlsFor(post) : undefined
    return <div key={post.id} className={focusedId === post.id ? "rounded-2xl ring-4 ring-brand/35 ring-offset-4 ring-offset-lavender transition-all" : "transition-all"}><PostCard post={post} onHide={onHide} onDelete={onDelete} serverBacked={isServer} eventRsvp={eventRsvp} /></div>
  })}<EventDetailsDialog
    view={activeView}
    detail={activeDetail}
    open={openEventId !== null}
    onOpenChange={(next) => !next && setOpenEventId(null)}
    going={activeView ? Boolean(rsvpView[activeView.id]?.going) : false}
    interested={activeView ? Boolean(rsvpView[activeView.id]?.interested) : false}
    onSetRsvp={(flags) => activePost && setInterest(activePost, flags)}
    onShare={() => activeView && shareEvent(activeView)}
    onSaveEdit={async (patch) => {
      if (!activePost) return
      // DB-backed event: persist in place through the existing posts pipeline
      // (same id/organizer, RSVP rows untouched), then revalidate the server
      // feed so the Home Feed card and Events page both reflect the edit.
      if (serverIds.has(activePost.id)) { await updateEventPost(activePost.id, patch as Record<string, unknown>); await mutate() }
      else updatePost(activePost.id, { event: patch as EventDetails })
    }}
    onDelete={async () => {
      if (!activePost) return
      // DB-backed event: delete through the existing author-scoped action (which
      // cascades its public.event_rsvps cleanup), then revalidate so it vanishes
      // from the Home Feed and stays gone after refresh.
      if (serverIds.has(activePost.id)) { await deletePost(activePost.id); await mutate() }
      else removePost(activePost.id)
      setOpenEventId(null)
    }}
  /></div>
}
