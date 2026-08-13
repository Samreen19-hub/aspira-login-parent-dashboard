"use client"

import { useState } from "react"
import { Trophy, ImageIcon, BarChart3, Calendar, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

const actions = [
  { key: "achievement", label: "Achievements", icon: Trophy, color: "text-amber-500" },
  { key: "photo", label: "Upload Photo", icon: ImageIcon, color: "text-emerald-500" },
  { key: "poll", label: "Poll", icon: BarChart3, color: "text-rose-500" },
  { key: "event", label: "Events", icon: Calendar, color: "text-blue-500" },
]

export function PostComposer({ onPost }: { onPost?: (text: string) => void }) {
  const { user } = useAuth()
  const [text, setText] = useState("")

  function handlePost() {
    if (!text.trim()) return
    onPost?.(text.trim())
    setText("")
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("") ?? "P"

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="size-11 shrink-0">
          <AvatarImage src="/avatar-rashi.png" alt={user?.name ?? "You"} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) handlePost()
          }}
          placeholder="Share your child's achievements, moments or updates..."
          className="h-12 w-full rounded-full border border-input bg-secondary/50 px-5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20"
          aria-label="Create a post"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <a.icon className={`size-4 ${a.color}`} />
            <span className="hidden sm:inline">{a.label}</span>
          </button>
        ))}
        <Button onClick={handlePost} disabled={!text.trim()} className="gap-2 rounded-lg px-6">
          <Send className="size-4" />
          Post
        </Button>
      </div>
    </div>
  )
}
