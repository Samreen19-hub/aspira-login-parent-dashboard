"use client"

import Link from "next/link"
import { useRef, useState, type ChangeEvent } from "react"
import { GraduationCap, School, TrendingUp, Plus, MoreVertical, Pencil, Trash2, Camera, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageShell } from "@/components/parent/page-shell"
import { ProgressRing } from "@/components/parent/progress-ring"
import { useChildrenStore } from "@/components/parent/children-store"
import type { Child } from "@/lib/parent-data"

type ChildForm = {
  name: string
  dob: string
  className: string
  school: string
  relationship: string
  avatar: string
}

const EMPTY_FORM: ChildForm = { name: "", dob: "", className: "", school: "", relationship: "Child", avatar: "" }

const FIELDS: { key: keyof Omit<ChildForm, "avatar">; label: string; type?: string; placeholder?: string }[] = [
  { key: "name", label: "Child's Name" },
  { key: "dob", label: "Date of Birth", type: "date" },
  { key: "className", label: "Grade/Class" },
  { key: "school", label: "School" },
  { key: "relationship", label: "Relationship", placeholder: "Parent, guardian..." },
]

export default function ChildrenPage() {
  const { children, addChild, updateChild, deleteChild } = useChildrenStore()
  // `null` = closed, "add" = new child, otherwise the id of the child being edited.
  const [editing, setEditing] = useState<null | "add" | string>(null)
  const [form, setForm] = useState<ChildForm>(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState<Child | null>(null)

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditing("add")
  }

  function openEdit(child: Child) {
    setForm({
      name: child.name,
      dob: child.dob ?? "",
      className: child.className,
      school: child.school,
      relationship: child.relationship ?? "Child",
      avatar: child.avatar && child.avatar !== "/placeholder.svg" ? child.avatar : "",
    })
    setEditing(child.id)
  }

  function update(key: keyof ChildForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const valid = form.name.trim() && form.className.trim() && form.school.trim()

  function save() {
    if (!valid) return
    const shared = {
      name: form.name.trim(),
      className: form.className.trim(),
      school: form.school.trim(),
      dob: form.dob,
      relationship: form.relationship.trim(),
      avatar: form.avatar || "/placeholder.svg",
    }
    if (editing === "add") {
      addChild({ id: `child-${Date.now()}`, progress: 0, ...shared })
    } else if (editing) {
      updateChild(editing, shared)
    }
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function confirmDelete() {
    if (pendingDelete) deleteChild(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <PageShell title="My Children" description="Track progress and manage your children's accounts.">
      <div className="grid gap-4 sm:grid-cols-2">
        {children.map((child) => (
          <Card key={child.id} className="gap-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-16">
                  <AvatarImage src={child.avatar || "/placeholder.svg"} alt={child.name} />
                  <AvatarFallback>{child.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-display font-semibold text-foreground">{child.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <GraduationCap className="size-4" /> {child.className}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <School className="size-4" /> {child.school}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <ProgressRing value={child.progress} size={56} />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`Manage ${child.name}`}>
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openEdit(child)} className="gap-2">
                      <Pencil className="size-4" /> Edit Child Info
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPendingDelete(child)} className="gap-2 text-destructive">
                      <Trash2 className="size-4" /> Delete Child
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-brand-muted px-3 py-2.5 text-sm text-brand">
              <TrendingUp className="size-4" />
              <span className="font-medium">
                {child.progress ? `${child.progress}% overall performance this term` : "New child profile added"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                render={<Link href={`/parent/timetable?childId=${child.id}`} />}
              >
                Timetable
              </Button>
              <Button className="flex-1 rounded-xl" render={<Link href={`/parent/children/${child.id}/feed`} />}>
                View Feed
              </Button>
            </div>
          </Card>
        ))}
        <button
          type="button"
          onClick={openAdd}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <span className="grid size-11 place-items-center rounded-full bg-brand-muted text-brand">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-medium">Add Another Child</span>
        </button>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "add" ? "Add Child" : "Edit Child Info"}</DialogTitle>
            <DialogDescription>
              {editing === "add"
                ? "Add a child profile to your Aspira account."
                : "Update this child's profile. Changes apply everywhere."}
            </DialogDescription>
          </DialogHeader>

          <AvatarPicker name={form.name} value={form.avatar} onChange={(value) => update("avatar", value)} />

          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={`child-${field.key}`}>{field.label}</Label>
                <Input
                  id={`child-${field.key}`}
                  type={field.type ?? "text"}
                  value={form[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!valid}>
              {editing === "add" ? "Add Child" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={pendingDelete !== null} onOpenChange={(next) => !next && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Child?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {pendingDelete?.name}? This will remove the child from your Parent account
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete Child
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}

/* -------------------------------------------------------------------------- */
/*  Avatar picker — optional profile picture, stored as a data URL             */
/* -------------------------------------------------------------------------- */

function AvatarPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : "")
    reader.readAsDataURL(file)
    // Allow re-selecting the same file later.
    event.target.value = ""
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar size="lg" className="size-16">
          <AvatarImage src={value || "/placeholder.svg"} alt={name || "Child avatar"} />
          <AvatarFallback>{name.trim()?.[0]?.toUpperCase() || "?"}</AvatarFallback>
        </Avatar>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove profile picture"
            className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="grid gap-1">
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-1.5 rounded-xl"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="size-4" />
          {value ? "Change Picture" : "Upload Picture"}
        </Button>
        <p className="text-xs text-muted-foreground">Optional. A default avatar is used if none is added.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
    </div>
  )
}
