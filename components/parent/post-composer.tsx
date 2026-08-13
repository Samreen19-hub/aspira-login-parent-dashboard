"use client"

import { useRef, useState } from "react"
import { Trophy, ImageIcon, BarChart3, Calendar, Send } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import type { FeedPostType } from "@/lib/parent-data"

type Draft = { type: FeedPostType; body: string; image?: string; achievement?: { title: string; child: string; description: string }; poll?: { question: string; options: string[] }; event?: { title: string; date: string; time: string; location: string; description: string } }
const actions = [{ key: "achievement", label: "Achievement", icon: Trophy }, { key: "photo", label: "Photo", icon: ImageIcon }, { key: "poll", label: "Poll", icon: BarChart3 }, { key: "event", label: "Event", icon: Calendar }] as const

type Mode = Exclude<typeof actions[number]["key"], "photo">
function formatEventDate(value: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`))
}
export function PostComposer({ onPost }: { onPost?: (draft: Draft) => void }) {
  const { user } = useAuth(); const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(""); const [mode, setMode] = useState<Mode | null>(null); const [image, setImage] = useState<string>()
  const [form, setForm] = useState({ title: "", child: "Aarav Kapoor", description: "", question: "", option1: "", option2: "", date: "", time: "", location: "" })
  const initials = user?.name?.split(" ").map((n) => n[0]).slice(0, 2).join("") ?? "P"
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)) }
  function publish() {
    if (mode === "achievement" && (!form.title.trim() || !form.description.trim())) return
    if (mode === "poll" && (!form.question.trim() || !form.option1.trim() || !form.option2.trim())) return
    if (mode === "event" && (!form.title.trim() || !form.date || !form.time || !form.location.trim())) return
    const type = mode === "achievement" || mode === "poll" || mode === "event" ? mode : image ? "photo" : "text"
    const body = type === "text" || type === "photo" ? text.trim() : ""
    if (!body && !image && type === "text") return
    onPost?.({ type, body, image: type === "photo" ? image : undefined, achievement: type === "achievement" ? { title: form.title, child: form.child, description: form.description } : undefined, poll: type === "poll" ? { question: form.question, options: [form.option1, form.option2] } : undefined, event: type === "event" ? { title: form.title, date: formatEventDate(form.date), time: form.time, location: form.location, description: form.description } : undefined })
    setText(""); setImage(undefined); setMode(null); setForm({ title: "", child: "Aarav Kapoor", description: "", question: "", option1: "", option2: "", date: "", time: "", location: "" })
  }
  return <div className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><Avatar className="size-11 shrink-0"><AvatarImage src={user?.avatar ?? "/avatar-rashi.png"} alt={user?.name ?? "You"} /><AvatarFallback>{initials}</AvatarFallback></Avatar><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) publish() }} placeholder="Share your child's achievements, moments or updates..." className="h-12 w-full rounded-full border border-input bg-secondary/50 px-5 text-sm outline-none focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20" aria-label="Create a post" /></div>{image && <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><img src={image} alt="Selected preview" className="size-12 rounded-lg object-cover" /> Photo attached</div>}<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions.map((action) => <button key={action.key} type="button" onClick={() => action.key === "photo" ? fileRef.current?.click() : setMode(action.key)} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-secondary"><action.icon className="size-4 text-brand" /><span className="hidden sm:inline">{action.label}</span></button>)}<input ref={fileRef} type="file" accept="image/*" onChange={chooseFile} className="sr-only" /><Button onClick={publish} disabled={mode === null && !text.trim() && !image} className="gap-2 rounded-lg px-6"><Send className="size-4" />Post</Button></div><Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}><DialogContent><DialogHeader><DialogTitle>{mode === "achievement" ? "Share an Achievement" : mode === "poll" ? "Create a Poll" : "Create an Event"}</DialogTitle><DialogDescription>Share an update with your parent network.</DialogDescription></DialogHeader><div className="grid gap-4">{mode === "achievement" && <><Field label="Achievement title" value={form.title} onChange={(v) => update("title", v)} /><Field label="Child" value={form.child} onChange={(v) => update("child", v)} /><FieldArea label="Description" value={form.description} onChange={(v) => update("description", v)} /></>}{mode === "poll" && <><Field label="Question" value={form.question} onChange={(v) => update("question", v)} /><Field label="Option 1" value={form.option1} onChange={(v) => update("option1", v)} /><Field label="Option 2" value={form.option2} onChange={(v) => update("option2", v)} /></>}{mode === "event" && <><Field label="Event title" value={form.title} onChange={(v) => update("title", v)} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Date" type="date" value={form.date} onChange={(v) => update("date", v)} /><Field label="Time" type="time" value={form.time} onChange={(v) => update("time", v)} /></div><Field label="Location" value={form.location} onChange={(v) => update("location", v)} /><FieldArea label="Description" value={form.description} onChange={(v) => update("description", v)} /></>}</div><DialogFooter><Button variant="outline" onClick={() => setMode(null)}>Cancel</Button><Button onClick={publish}>Publish</Button></DialogFooter></DialogContent></Dialog></div>
}
function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="grid gap-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div> }
function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div className="grid gap-2"><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} /></div> }
export type { Draft }
