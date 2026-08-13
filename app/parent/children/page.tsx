"use client"

import Link from "next/link"
import { useState } from "react"
import { GraduationCap, School, TrendingUp, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageShell } from "@/components/parent/page-shell"
import { ProgressRing } from "@/components/parent/progress-ring"
import { CHILDREN, type Child } from "@/lib/parent-data"

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>(CHILDREN)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: "", dob: "", className: "", school: "", relationship: "Child" })

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addChild() {
    if (!form.name.trim() || !form.className.trim() || !form.school.trim()) return
    setChildren((current) => [...current, {
      id: `child-${Date.now()}`,
      name: form.name.trim(), className: form.className.trim(), school: form.school.trim(),
      avatar: "/placeholder.svg", progress: 0,
    }])
    setForm({ name: "", dob: "", className: "", school: "", relationship: "Child" })
    setOpen(false)
  }

  return (
    <PageShell title="My Children" description="Track progress and manage your children's accounts.">
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id} className="gap-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-16"><AvatarImage src={child.avatar || "/placeholder.svg"} alt={child.name} /><AvatarFallback>{child.name[0]}</AvatarFallback></Avatar>
                <div><p className="font-display font-semibold text-foreground">{child.name}</p><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><GraduationCap className="size-4" /> {child.className}</p><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><School className="size-4" /> {child.school}</p></div>
              </div><ProgressRing value={child.progress} size={56} />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-brand-muted px-3 py-2.5 text-sm text-brand"><TrendingUp className="size-4" /><span className="font-medium">{child.progress ? `${child.progress}% overall performance this term` : "New child profile added"}</span></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1 rounded-xl" render={<Link href="/parent/timetable" />}>Timetable</Button><Button className="flex-1 rounded-xl" render={<Link href={`/parent/children/${child.id}/feed`} />}>View Feed</Button></div>
          </Card>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"><span className="grid size-11 place-items-center rounded-full bg-brand-muted text-brand"><Plus className="size-5" /></span><span className="text-sm font-medium">Add Another Child</span></button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add Child</DialogTitle><DialogDescription>Add a child profile to your Aspira account.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {([['name', "Child's Name"], ['dob', 'Date of Birth'], ['className', 'Grade/Class'], ['school', 'School'], ['relationship', 'Relationship']] as const).map(([key, label]) => <div key={key} className="grid gap-2"><Label htmlFor={`child-${key}`}>{label}</Label><Input id={`child-${key}`} type={key === 'dob' ? 'date' : 'text'} value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={key === 'relationship' ? 'Parent, guardian...' : undefined} /></div>)}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={addChild} disabled={!form.name.trim() || !form.className.trim() || !form.school.trim()}>Add Child</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
