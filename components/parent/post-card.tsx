"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Globe, Smile, Camera, Send, Copy, Users, MessageSquare, Trophy, Sparkles, Leaf } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { FeedPost } from "@/lib/parent-data"

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
}

export function PostCard({ post, onRemove }: { post: FeedPost; onRemove?: () => void }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState("")
  const [comments, setComments] = useState(post.comments)
  const [shareOpen, setShareOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [commentImage, setCommentImage] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pollVotes, setPollVotes] = useState(post.poll?.votes ?? [])
  const [voted, setVoted] = useState<number | null>(null)
  const [feedback, setFeedback] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  const likeCount = post.likes + (liked ? 1 : 0)

  function addComment() {
    if (!comment.trim() && !commentImage) return
    setComments((prev) => [...prev, { id: `c-${Date.now()}`, author: "Rashi Kapoor", avatar: "/avatar-rashi.png", text: comment.trim(), image: commentImage, time: "now" }])
    setComment(""); setCommentImage(undefined)
    setShowComments(true)
  }

  return (
    <article className="relative rounded-2xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <Avatar className="size-11">
          <AvatarImage src={post.avatar || "/placeholder.svg"} alt={post.author} />
          <AvatarFallback>{initialsOf(post.author)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{post.author}</span>
            <Badge
              variant="secondary"
              className="bg-brand-muted text-[11px] font-medium text-accent-foreground"
            >
              {post.role}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{post.subtitle}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{post.time}</span>
            <span>·</span>
            <Globe className="size-3" />
            <span>{post.visibility}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Post options"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="size-5" />
        </button>
        {menuOpen && <div ref={menuRef} className="absolute right-4 top-14 z-10 grid min-w-36 gap-1 rounded-xl border border-border bg-card p-1 shadow-lg"><button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { setSaved(true); setMenuOpen(false); setFeedback("Post saved") }}>Save post</button><button type="button" className="rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { setMenuOpen(false); onRemove?.() }}>Hide post</button><button type="button" className="rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-secondary" onClick={() => { setMenuOpen(false); onRemove?.() }}>Delete post</button></div>}
      </div>

      {feedback && <button type="button" onClick={() => setFeedback("")} className="mx-4 mt-2 rounded-lg bg-brand-muted px-3 py-2 text-left text-sm text-brand">{feedback}</button>}

      {post.type === "text" && <div className="px-4 pb-3"><p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground text-pretty">{post.body}</p><Hashtags tags={post.hashtags} /></div>}
      {post.type === "photo" && <div className="px-4 pb-3"><p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground text-pretty">{post.body}</p><Hashtags tags={post.hashtags} /></div>}
      {post.type === "achievement" && post.achievement && <AchievementPost achievement={post.achievement} />}
      {post.type === "event" && post.event && <div className="mx-4 mb-3 rounded-xl border border-brand/20 bg-brand-muted p-4"><p className="text-sm font-semibold text-brand">Upcoming event</p><p className="mt-1 font-display text-lg font-bold text-foreground">{post.event.title}</p><p className="text-sm text-muted-foreground">{post.event.date} · {post.event.time} · {post.event.location}</p><p className="mt-1 text-sm text-foreground">{post.event.description}</p></div>}
      {post.type === "poll" && post.poll && <PollCard poll={post.poll} pollVotes={pollVotes} voted={voted} onVote={(index) => { if (index === voted) return; setPollVotes((votes) => votes.map((vote, i) => vote + (i === index ? 1 : i === voted ? -1 : 0))); setVoted(index) }} />}
      {/* Image */}
      {post.image && (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
          <Image src={post.image || "/placeholder.svg"} alt="Post attachment" fill className="object-cover" />
        </div>
      )}

      {/* Stats + actions */}
      <div className="px-4">
        <div className="flex items-center justify-between border-b border-border py-3">
          <button
            type="button"
            onClick={() => setLiked((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            <span
              className={`grid size-6 place-items-center rounded-full ${liked ? "bg-brand text-brand-foreground" : "bg-brand-muted text-brand"}`}
            >
              <Heart className="size-3.5" fill="currentColor" />
            </span>
            <span className="font-medium tabular-nums">{likeCount}</span>
          </button>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <button type="button" onClick={() => setShowComments((v) => !v)} className="hover:text-foreground">
              {comments.length} comments
            </button>
            <span>{post.shares} shares</span>
          </div>
        </div>

        <div className="flex items-center justify-between py-1.5">
          <ActionButton icon={Heart} label="Like" active={liked} onClick={() => setLiked((v) => !v)} />
          <ActionButton icon={MessageCircle} label="Comment" onClick={() => setShowComments((v) => !v)} />
          <ActionButton icon={Share2} label="Share" onClick={() => setShareOpen(true)} />
          <ActionButton
            icon={Bookmark}
            label="Save"
            active={saved}
            onClick={() => setSaved((v) => !v)}
            className="flex-none"
            iconOnly
          />
        </div>
      </div>

      {/* Liked by + comments */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {comments.slice(0, 3).map((c) => (
                <Avatar key={c.id} className="size-6 ring-2 ring-card">
                  <AvatarImage src={c.avatar || "/placeholder.svg"} alt="" />
                  <AvatarFallback>{initialsOf(c.author)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{post.likedByLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="text-sm font-medium text-brand hover:underline"
          >
            View all comments ({comments.length})
          </button>
        </div>

        {showComments && (
          <ul className="mt-3 space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <Avatar className="size-8">
                  <AvatarImage src={c.avatar || "/placeholder.svg"} alt={c.author} />
                  <AvatarFallback>{initialsOf(c.author)}</AvatarFallback>
                </Avatar>
                <div className="rounded-2xl bg-secondary/70 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{c.author}</span>
                    <span className="text-xs text-muted-foreground">{c.time}</span>
                  </div>
                  {c.text && <p className="text-sm text-foreground">{c.text}</p>}
                  {c.image && <Image src={c.image} alt="Comment attachment" width={180} height={120} className="mt-2 rounded-lg object-cover" />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Comment box */}
      <div className="flex items-center gap-3 border-t border-border p-4">
        <Avatar className="size-9 shrink-0">
          <AvatarImage src="/avatar-rashi.png" alt="You" />
          <AvatarFallback>RK</AvatarFallback>
        </Avatar>
        <div className="flex h-11 flex-1 items-center gap-2 rounded-full border border-input bg-secondary/50 pl-4 pr-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) addComment()
            }}
            placeholder="Write a comment..."
            className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Write a comment"
          />
          <div className="flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => setEmojiOpen((v) => !v)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Add emoji"><Smile className="size-4" /></button>
            <label className="rounded-full p-1.5 hover:bg-secondary" aria-label="Add photo"><Camera className="size-4" /><input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) setCommentImage(URL.createObjectURL(file)) }} /></label>
            {commentImage && <div className="relative"><Image src={commentImage} alt="Selected comment attachment" width={52} height={52} className="size-13 rounded-lg object-cover" /><button type="button" onClick={() => setCommentImage(undefined)} className="absolute -right-1 -top-1 rounded-full bg-foreground px-1 text-xs text-background" aria-label="Remove selected photo">×</button></div>}
            <button
              type="button"
              onClick={addComment}
              disabled={!comment.trim() && !commentImage}
              className="rounded-full p-1.5 text-brand hover:bg-secondary disabled:opacity-40"
              aria-label="Send comment"
            >
              <Send className="size-4" />
            </button>
          </div>
          {emojiOpen && <div className="absolute z-10 mt-12 rounded-xl border border-border bg-card p-2 shadow-lg"><div className="flex gap-1 text-lg">{["😀", "👏", "🎉", "❤️", "😊", "👍"].map((emoji) => <button type="button" key={emoji} onClick={() => { setComment((value) => `${value}${emoji}`); setEmojiOpen(false) }} className="rounded-lg p-1 hover:bg-secondary">{emoji}</button>)}</div></div>}
        </div>
      </div>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent><DialogHeader><DialogTitle>Share post</DialogTitle><DialogDescription>Choose how you would like to share this update.</DialogDescription></DialogHeader><div className="grid gap-2"><Button variant="outline" className="justify-start gap-2" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/parent/posts/${post.id}`) } catch {} setCopied(true); setTimeout(() => setCopied(false), 1800) }}><Copy className="size-4" />{copied ? "Link copied!" : "Copy Link"}</Button><Button variant="outline" className="justify-start gap-2"><Users className="size-4" />Share to Network</Button><Button variant="outline" className="justify-start gap-2"><MessageSquare className="size-4" />Share via Message</Button></div><DialogFooter><Button variant="outline" onClick={() => setShareOpen(false)}>Done</Button></DialogFooter></DialogContent></Dialog>
    </article>
  )
}

function AchievementPost({ achievement }: { achievement: NonNullable<FeedPost["achievement"]> }) {
  return <section aria-label={`Achievement for ${achievement.child}`} className="relative mx-4 mb-4 overflow-hidden rounded-2xl border border-[#e5c45d] bg-[#faf8ff] px-4 py-5 shadow-[0_8px_20px_-16px_rgba(86,44,180,0.55)] sm:px-8 sm:py-6">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_12%_18%,rgba(217,184,76,0.7)_0_2px,transparent_3px),radial-gradient(circle_at_88%_22%,rgba(111,50,213,0.45)_0_2px,transparent_3px),radial-gradient(circle_at_9%_84%,rgba(217,184,76,0.55)_0_2px,transparent_3px),radial-gradient(circle_at_92%_82%,rgba(111,50,213,0.4)_0_2px,transparent_3px)]" />
    <div className="relative flex flex-col items-center text-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20 flex justify-between px-1 text-[#d9b84c]/45 sm:px-4"><div className="flex -rotate-12 gap-1"><Leaf className="size-7" /><Leaf className="size-5 rotate-45" /><Leaf className="size-4 rotate-90" /></div><div className="flex rotate-12 gap-1"><Leaf className="size-7 -scale-x-100" /><Leaf className="size-5 -rotate-45 -scale-x-100" /><Leaf className="size-4 -rotate-90 -scale-x-100" /></div></div>
      <div className="flex w-full items-center justify-center gap-2 text-[#cda83c]" aria-hidden="true"><span className="h-px w-12 bg-[#d9b84c]/70" /><Sparkles className="size-3.5 text-[#6f32d5]" /><Badge className="border-0 bg-[#6f32d5] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Achievement unlocked</Badge><Sparkles className="size-3.5 text-[#6f32d5]" /><span className="h-px w-12 bg-[#d9b84c]/70" /></div>
      <div className="relative mt-4 grid size-20 place-items-center rounded-full border-2 border-[#e7bd43] bg-[#fff9db] shadow-[0_0_0_8px_rgba(231,189,67,0.10),0_0_28px_rgba(231,189,67,0.22)]" aria-hidden="true"><Trophy className="size-9 text-[#d49f17]" strokeWidth={1.7} /></div>
      <p className="mt-3 text-xs font-medium text-[#493b70]">We are proud to share that</p>
      <h3 className="mt-0.5 max-w-full break-words font-display text-2xl font-bold text-[#5930b5]">{achievement.child}</h3>
      <div className="my-2 flex w-full max-w-lg items-center gap-2" aria-hidden="true"><span className="h-px flex-1 bg-[#d9b84c]/70" /><Sparkles className="size-3 text-[#d9b84c]" /><span className="h-px flex-1 bg-[#d9b84c]/70" /></div>
      <p className="text-xs font-medium text-[#493b70]">has achieved</p>
      <div className="relative mt-2 w-full max-w-md rounded-xl border border-[#dfb83f] bg-background px-4 py-2.5 shadow-sm"><Sparkles aria-hidden="true" className="absolute -left-2 -top-2 size-4 text-[#d9b84c]" /><Sparkles aria-hidden="true" className="absolute -right-2 -bottom-2 size-4 text-[#d9b84c]" /><p className="break-words font-display text-3xl font-bold leading-tight text-[#4e27a3] sm:text-4xl">{achievement.title}</p></div>
      <div className="relative mt-3 w-full max-w-xl rounded-xl border border-[#ded3f2] bg-[#f4efff]/85 px-5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"><span aria-hidden="true" className="absolute left-2 top-0 text-3xl leading-none text-[#8b65d6]">&ldquo;</span><p className="whitespace-pre-line break-words px-3 text-center text-sm leading-6 text-[#493b70]">{achievement.description}</p><span aria-hidden="true" className="absolute bottom-[-5px] right-2 text-3xl leading-none text-[#8b65d6]">&rdquo;</span></div><div aria-hidden="true" className="mt-4 flex items-center gap-3 text-[#d9b84c]/70"><span className="h-px w-12 bg-[#d9b84c]/60" /><Sparkles className="size-3" /><span className="h-px w-12 bg-[#d9b84c]/60" /></div>
    </div>
  </section>
}

function Hashtags({ tags }: { tags: string[] }) {
  if (!tags.length) return null
  return <p className="mt-2 flex flex-wrap gap-x-2 text-sm font-medium text-brand">{tags.map((tag) => <span key={tag}>{tag}</span>)}</p>
}

function PollCard({ poll, pollVotes, voted, onVote }: { poll: NonNullable<FeedPost["poll"]>; pollVotes: number[]; voted: number | null; onVote: (index: number) => void }) {
  const total = pollVotes.reduce((sum, vote) => sum + vote, 0)
  return <div className="mx-4 mb-3 grid gap-2 rounded-xl border border-border p-4"><p className="font-semibold text-foreground">{poll.question}</p>{poll.options.map((option, index) => { const count = pollVotes[index] ?? 0; const percentage = total ? Math.round((count / total) * 100) : 0; return <button key={option} type="button" aria-pressed={voted === index} onClick={() => onVote(index)} className={`relative flex min-h-10 items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left text-sm ${voted === index ? "border-brand bg-brand-muted text-brand" : "border-border hover:bg-secondary"}`}><span className="absolute inset-y-0 left-0 bg-brand-muted" style={{ width: `${percentage}%` }} /><span className="relative">{option}</span><span className="relative tabular-nums">{voted !== null ? `${percentage}%` : count}</span></button> })}<p className="text-xs text-muted-foreground">{total} {total === 1 ? "vote" : "votes"}{voted !== null ? " · You voted" : ""}</p></div>
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
  className = "",
  iconOnly = false,
}: {
  icon: React.ElementType
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
  iconOnly?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-secondary ${
        active ? "text-brand" : "text-muted-foreground"
      } ${className}`}
      aria-pressed={active}
    >
      <Icon className="size-[18px]" fill={active ? "currentColor" : "none"} />
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  )
}
