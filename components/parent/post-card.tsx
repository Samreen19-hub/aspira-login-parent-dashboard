"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Globe, Smile, Camera, Send, Copy, Users, MessageSquare } from "lucide-react"
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

export function PostCard({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comment, setComment] = useState("")
  const [comments, setComments] = useState(post.comments)
  const [shareOpen, setShareOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [commentImage, setCommentImage] = useState<string>()
  const [copied, setCopied] = useState(false)

  const likeCount = post.likes + (liked ? 1 : 0)

  function addComment() {
    if (!comment.trim() && !commentImage) return
    setComments((prev) => [...prev, { id: `c-${Date.now()}`, author: "Rashi Kapoor", avatar: "/avatar-rashi.png", text: `${comment.trim()}${commentImage ? " [photo attached]" : ""}`.trim(), time: "now" }])
    setComment(""); setCommentImage(undefined)
    setShowComments(true)
  }

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
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
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground text-pretty">{post.body}</p>
        {post.hashtags.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-2 text-sm font-medium text-brand">
            {post.hashtags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </p>
        )}
      </div>

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
                  <p className="text-sm text-foreground">{c.text}</p>
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
