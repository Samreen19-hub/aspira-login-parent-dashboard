"use client"

/**
 * Parent → Timetable (FRONTEND-ONLY prototype).
 *
 * A single, filter-driven, editable timetable:
 *   Institution Type → Class → Section → monthly period grid → edit/add/delete → Save.
 *
 * Persistence is intentionally frontend-only (localStorage), keyed per
 * child + institution-type + class + section, so each combination keeps its own
 * state and survives refreshes. There is NO database, API, schema, or auth
 * coupling here — that arrives when the real School Admin backend is built.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Plus,
  Save,
  Trash2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useChildrenStore } from "@/components/parent/children-store"

/* -------------------------------------------------------------------------- */
/*  Model + static config                                                      */
/* -------------------------------------------------------------------------- */

interface Entry {
  subject: string
  teacher: string
  room: string
  start: string
  end: string
  notes: string
}

/** grid[periodId][dayKey] -> entry (or null for an empty slot). */
type Grid = Record<string, Record<string, Entry | null>>

interface Period {
  id: string
  label: string
  time: string
  start: string
  end: string
}

const PERIODS: Period[] = [
  { id: "p1", label: "1", time: "8:00 AM – 8:45 AM", start: "8:00 AM", end: "8:45 AM" },
  { id: "p2", label: "2", time: "8:45 AM – 9:30 AM", start: "8:45 AM", end: "9:30 AM" },
  { id: "p3", label: "3", time: "9:45 AM – 10:30 AM", start: "9:45 AM", end: "10:30 AM" },
  { id: "p4", label: "4", time: "10:30 AM – 11:15 AM", start: "10:30 AM", end: "11:15 AM" },
  { id: "p5", label: "5", time: "11:30 AM – 12:15 PM", start: "11:30 AM", end: "12:15 PM" },
  { id: "p6", label: "6", time: "12:15 PM – 1:00 PM", start: "12:15 PM", end: "1:00 PM" },
  { id: "p7", label: "7", time: "1:45 PM – 2:30 PM", start: "1:45 PM", end: "2:30 PM" },
  { id: "p8", label: "8", time: "2:30 PM – 3:15 PM", start: "2:30 PM", end: "3:15 PM" },
]

const DAYS = [
  { key: "mon", name: "Mon" },
  { key: "tue", name: "Tue" },
  { key: "wed", name: "Wed" },
  { key: "thu", name: "Thu" },
  { key: "fri", name: "Fri" },
  { key: "sat", name: "Sat" },
] as const

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type InstitutionType = "school" | "university" | "college"

const INSTITUTION_TYPES: { key: InstitutionType; label: string }[] = [
  { key: "school", label: "School" },
  { key: "university", label: "University" },
  { key: "college", label: "College" },
]

const CLASS_OPTIONS: Record<InstitutionType, string[]> = {
  school: Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  university: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  college: ["1st Year", "2nd Year", "3rd Year"],
}

/** Label used for the "Class" filter, adapted per institution type. */
const CLASS_LABEL: Record<InstitutionType, string> = {
  school: "Class",
  university: "Year",
  college: "Year",
}

const SECTION_OPTIONS = ["A", "B", "C", "D"]

/* -------------------------------------------------------------------------- */
/*  Subject colour accents                                                     */
/* -------------------------------------------------------------------------- */

const ACCENTS: Record<string, { bar: string; bg: string }> = {
  Mathematics: { bar: "bg-blue-400", bg: "bg-blue-50/60" },
  English: { bar: "bg-violet-400", bg: "bg-violet-50/60" },
  Science: { bar: "bg-green-400", bg: "bg-green-50/60" },
  "Social Studies": { bar: "bg-orange-400", bg: "bg-orange-50/60" },
  Hindi: { bar: "bg-rose-400", bg: "bg-rose-50/60" },
  "Computer Science": { bar: "bg-teal-400", bg: "bg-teal-50/60" },
  "Art & Craft": { bar: "bg-fuchsia-400", bg: "bg-fuchsia-50/60" },
  Art: { bar: "bg-fuchsia-400", bg: "bg-fuchsia-50/60" },
  Music: { bar: "bg-amber-400", bg: "bg-amber-50/60" },
  "Physical Education": { bar: "bg-sky-400", bg: "bg-sky-50/60" },
  Robotics: { bar: "bg-amber-400", bg: "bg-amber-50/60" },
  History: { bar: "bg-orange-400", bg: "bg-orange-50/60" },
  Geography: { bar: "bg-cyan-400", bg: "bg-cyan-50/60" },
  Library: { bar: "bg-indigo-400", bg: "bg-indigo-50/60" },
}

const FALLBACK_ACCENTS = [
  { bar: "bg-violet-400", bg: "bg-violet-50/60" },
  { bar: "bg-emerald-400", bg: "bg-emerald-50/60" },
  { bar: "bg-sky-400", bg: "bg-sky-50/60" },
  { bar: "bg-amber-400", bg: "bg-amber-50/60" },
  { bar: "bg-rose-400", bg: "bg-rose-50/60" },
  { bar: "bg-teal-400", bg: "bg-teal-50/60" },
]

function accentFor(subject: string) {
  if (ACCENTS[subject]) return ACCENTS[subject]
  let hash = 0
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0
  return FALLBACK_ACCENTS[hash % FALLBACK_ACCENTS.length]
}

/* -------------------------------------------------------------------------- */
/*  Seed data (demo/UI-only, mirrors the reference design)                     */
/* -------------------------------------------------------------------------- */

/** [subject, teacher, room] per period-row × day-column, or null for empty. */
const SCHOOL_SEED: (readonly [string, string, string] | null)[][] = [
  [
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
    ["English", "Mr. Arjun Mehta", "Room 102"],
    ["Science", "Ms. Neha Verma", "Lab 1"],
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
    ["Social Studies", "Mr. Rohan Desai", "Room 104"],
    ["Computer Science", "Ms. Kavita Nair", "Lab 2"],
  ],
  [
    ["English", "Mr. Arjun Mehta", "Room 102"],
    ["Science", "Ms. Neha Verma", "Lab 1"],
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
    ["English", "Mr. Arjun Mehta", "Room 102"],
    ["Hindi", "Ms. Sunita Rao", "Room 103"],
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
  ],
  [
    ["Science", "Ms. Neha Verma", "Lab 1"],
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
    ["English", "Mr. Arjun Mehta", "Room 102"],
    ["Science", "Ms. Neha Verma", "Lab 1"],
    ["Mathematics", "Ms. Priya Sharma", "Room 101"],
    ["Art & Craft", "Ms. Pooja Iyer", "Room 105"],
  ],
  [
    ["Social Studies", "Mr. Rohan Desai", "Room 104"],
    ["Hindi", "Ms. Sunita Rao", "Room 103"],
    ["Social Studies", "Mr. Rohan Desai", "Room 104"],
    ["Hindi", "Ms. Sunita Rao", "Room 103"],
    ["Science", "Ms. Neha Verma", "Lab 1"],
    ["Music", "Mr. Sandeep Kulkarni", "Room 106"],
  ],
  [
    ["Hindi", "Ms. Sunita Rao", "Room 103"],
    ["Social Studies", "Mr. Rohan Desai", "Room 104"],
    ["Computer Science", "Ms. Kavita Nair", "Lab 2"],
    ["Art & Craft", "Ms. Pooja Iyer", "Room 105"],
    ["English", "Mr. Arjun Mehta", "Room 102"],
    ["Physical Education", "Mr. Vivek Shah", "Sports Ground"],
  ],
  [
    ["Computer Science", "Ms. Kavita Nair", "Lab 2"],
    ["Art & Craft", "Ms. Pooja Iyer", "Room 105"],
    ["Hindi", "Ms. Sunita Rao", "Room 103"],
    ["Music", "Mr. Sandeep Kulkarni", "Room 106"],
    ["Computer Science", "Ms. Kavita Nair", "Lab 2"],
    ["Science", "Ms. Neha Verma", "Lab 1"],
  ],
  [
    ["Physical Education", "Mr. Vivek Shah", "Sports Ground"],
    ["Computer Science", "Ms. Kavita Nair", "Lab 2"],
    ["Physical Education", "Mr. Vivek Shah", "Sports Ground"],
    ["Social Studies", "Mr. Rohan Desai", "Room 104"],
    ["Music", "Mr. Sandeep Kulkarni", "Room 106"],
    null,
  ],
  [null, null, null, null, null, null],
]

function emptyGrid(): Grid {
  const grid: Grid = {}
  for (const period of PERIODS) {
    grid[period.id] = {}
    for (const day of DAYS) grid[period.id][day.key] = null
  }
  return grid
}

/**
 * Default grid for a filter combination. Only the reference combination
 * (School · Class 8 · A) is seeded with sample classes; every other
 * combination starts empty and ready to fill in.
 */
function seedGrid(type: InstitutionType, klass: string, section: string): Grid {
  const grid = emptyGrid()
  if (type === "school" && klass === "Class 8" && section === "A") {
    PERIODS.forEach((period, pIndex) => {
      DAYS.forEach((day, dIndex) => {
        const seed = SCHOOL_SEED[pIndex]?.[dIndex]
        if (seed) {
          grid[period.id][day.key] = {
            subject: seed[0],
            teacher: seed[1],
            room: seed[2],
            start: period.start,
            end: period.end,
            notes: "",
          }
        }
      })
    })
  }
  return grid
}

/* -------------------------------------------------------------------------- */
/*  Date helpers (month → first consecutive Mon–Sat within that month)         */
/* -------------------------------------------------------------------------- */

function weekDatesForMonth(viewDate: Date): Date[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  // Date of the first Monday of the month (getDay: Sun=0 … Sat=6).
  const firstMonday = 1 + ((8 - first.getDay()) % 7)
  return DAYS.map((_, i) => new Date(year, month, firstMonday + i))
}

function storageKey(childId: string, type: InstitutionType, klass: string, section: string) {
  return `aspira:timetable:v1:${childId}:${type}:${klass}:${section}`
}

function readGrid(key: string): Grid | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Grid) : null
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/*  Timetable view                                                             */
/* -------------------------------------------------------------------------- */

export function TimetableView() {
  const { children } = useChildrenStore()
  const searchParams = useSearchParams()
  const initialChildId = searchParams.get("childId")
  const [selectedId, setSelectedId] = useState<string | null>(initialChildId)
  const activeChild = children.find((child) => child.id === selectedId) ?? children[0]
  const childId = activeChild?.id ?? "none"

  // Filters.
  const [type, setType] = useState<InstitutionType>("school")
  const [klass, setKlass] = useState("Class 8")
  const [section, setSection] = useState("A")

  // Month navigation (first day of the visible month).
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Timetable state + persistence bookkeeping.
  const [grid, setGrid] = useState<Grid>(() => seedGrid("school", "Class 8", "A"))
  const [dirty, setDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  const key = storageKey(childId, type, klass, section)

  // Load the stored grid (or a fresh seed) whenever the active combination changes.
  useEffect(() => {
    setGrid(readGrid(key) ?? seedGrid(type, klass, section))
    setDirty(false)
    setJustSaved(false)
  }, [key, type, klass, section])

  const weekDates = useMemo(() => weekDatesForMonth(viewDate), [viewDate])
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  // Editing dialog.
  const [editing, setEditing] = useState<{ periodId: string; dayKey: string } | null>(null)
  const [form, setForm] = useState<Entry>({ subject: "", teacher: "", room: "", start: "", end: "", notes: "" })

  function openEditor(periodId: string, dayKey: string) {
    const existing = grid[periodId]?.[dayKey]
    const period = PERIODS.find((p) => p.id === periodId)!
    setForm(
      existing ?? { subject: "", teacher: "", room: "", start: period.start, end: period.end, notes: "" },
    )
    setEditing({ periodId, dayKey })
  }

  function commitEntry() {
    if (!editing || !form.subject.trim()) return
    const { periodId, dayKey } = editing
    setGrid((prev) => ({
      ...prev,
      [periodId]: { ...prev[periodId], [dayKey]: { ...form, subject: form.subject.trim() } },
    }))
    setDirty(true)
    setJustSaved(false)
    setEditing(null)
  }

  function deleteEntry() {
    if (!editing) return
    const { periodId, dayKey } = editing
    setGrid((prev) => ({ ...prev, [periodId]: { ...prev[periodId], [dayKey]: null } }))
    setDirty(true)
    setJustSaved(false)
    setEditing(null)
  }

  function saveTimetable() {
    try {
      window.localStorage.setItem(key, JSON.stringify(grid))
      setDirty(false)
      setJustSaved(true)
      window.setTimeout(() => setJustSaved(false), 2200)
    } catch {
      // Ignore storage failures (e.g. private mode); prototype persistence only.
    }
  }

  function shiftMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function changeType(next: InstitutionType) {
    setType(next)
    setKlass(CLASS_OPTIONS[next][0])
    setSection("A")
  }

  const editingExisting = editing ? Boolean(grid[editing.periodId]?.[editing.dayKey]) : false

  return (
    <div className="mx-auto max-w-6xl">
      {/* Heading + child selector */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/parent"
              aria-label="Back"
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="font-display text-3xl font-bold text-foreground text-balance">Timetable</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            A clear, editable view of your child&apos;s weekly schedule.
          </p>
        </div>

        {children.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="h-12 justify-between gap-3 rounded-xl px-3 sm:w-60">
                  <span className="flex items-center gap-2.5">
                    <Avatar className="size-8">
                      <AvatarImage src={activeChild?.avatar || "/placeholder.svg"} alt={activeChild?.name} />
                      <AvatarFallback>{activeChild?.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{activeChild?.name ?? "Select child"}</span>
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent className="w-60">
              {children.map((child) => (
                <DropdownMenuItem key={child.id} onClick={() => setSelectedId(child.id)} className="gap-2.5 py-2">
                  <Avatar className="size-7">
                    <AvatarImage src={child.avatar || "/placeholder.svg"} alt={child.name} />
                    <AvatarFallback>{child.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{child.name}</span>
                    <span className="text-xs text-muted-foreground">{child.className}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Controls: filters (left) + month nav & save (right) */}
      <div className="mb-4 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <FilterDropdown
            label="Institution Type"
            value={INSTITUTION_TYPES.find((t) => t.key === type)?.label ?? ""}
            options={INSTITUTION_TYPES.map((t) => t.label)}
            onSelect={(label) => {
              const next = INSTITUTION_TYPES.find((t) => t.label === label)
              if (next) changeType(next.key)
            }}
          />
          <FilterDropdown
            label={CLASS_LABEL[type]}
            value={klass}
            options={CLASS_OPTIONS[type]}
            onSelect={setKlass}
          />
          <FilterDropdown label="Section" value={section} options={SECTION_OPTIONS} onSelect={setSection} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span
              className="min-w-36 text-center font-display text-sm font-semibold text-foreground"
              aria-live="polite"
            >
              {monthLabel}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-lg"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button onClick={saveTimetable} className="h-10 gap-2 rounded-xl">
            <Save className="size-4" />
            {justSaved ? "Saved" : "Save Timetable"}
          </Button>
        </div>
      </div>

      {/* Context line */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{INSTITUTION_TYPES.find((t) => t.key === type)?.label}</Badge>
        <Badge variant="outline">
          {CLASS_LABEL[type]}: {klass}
        </Badge>
        <Badge variant="outline">Section: {section}</Badge>
        {dirty && (
          <span className="ml-auto text-xs font-medium text-amber-600">Unsaved changes</span>
        )}
      </div>

      {/* Timetable grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            {`Timetable for ${klass} section ${section}, ${monthLabel}`}
          </caption>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[150px] border-b border-r border-border bg-muted/60 px-3 py-3 text-left text-xs font-semibold text-foreground">
                Period / Time
              </th>
              {DAYS.map((day, i) => (
                <th
                  key={day.key}
                  className="min-w-[150px] border-b border-r border-border bg-muted/60 px-3 py-2 text-center last:border-r-0"
                  scope="col"
                >
                  <div className="text-xs font-semibold text-foreground">{day.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {weekDates[i].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[150px] border-b border-r border-border bg-card px-3 py-2 text-left align-top"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                      {period.label}
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                      {period.time}
                    </span>
                  </div>
                </th>
                {DAYS.map((day) => {
                  const entry = grid[period.id]?.[day.key]
                  return (
                    <td
                      key={day.key}
                      className="border-b border-r border-border p-1.5 align-top last:border-r-0"
                    >
                      {entry ? (
                        <TimetableCell entry={entry} onClick={() => openEditor(period.id, day.key)} />
                      ) : (
                        <EmptyCell onClick={() => openEditor(period.id, day.key)} />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer notes */}
      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="size-4" />
          Tap any cell to add, edit, or remove a class. Remember to Save.
        </p>
        <p className="text-xs text-muted-foreground">
          Prototype: changes are saved on this device only, per class &amp; section.
        </p>
      </div>

      {/* Edit / add dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExisting ? "Edit class" : "Add class"}</DialogTitle>
            <DialogDescription>
              Update the details for this period. Changes are kept locally until you save the timetable.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tt-subject">Subject</Label>
              <Input
                id="tt-subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Mathematics"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tt-teacher">Teacher</Label>
              <Input
                id="tt-teacher"
                value={form.teacher}
                onChange={(e) => setForm((f) => ({ ...f, teacher: e.target.value }))}
                placeholder="e.g. Ms. Priya Sharma"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tt-room">Room / Classroom</Label>
              <Input
                id="tt-room"
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                placeholder="e.g. Room 101"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tt-start">Start time</Label>
                <Input
                  id="tt-start"
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  placeholder="8:00 AM"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tt-end">End time</Label>
                <Input
                  id="tt-end"
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  placeholder="8:45 AM"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tt-notes">Notes (optional)</Label>
              <Textarea
                id="tt-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything to remember for this class"
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {editingExisting ? (
              <Button variant="outline" onClick={deleteEntry} className="gap-2 text-destructive">
                <Trash2 className="size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={commitEntry} disabled={!form.subject.trim()}>
                {editingExisting ? "Save changes" : "Add class"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Presentational pieces                                                      */
/* -------------------------------------------------------------------------- */

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string
  value: string
  options: string[]
  onSelect: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="h-10 w-44 justify-between gap-2 rounded-xl px-3">
              <span className="truncate font-medium text-foreground">{value}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent className="max-h-72 w-44 overflow-y-auto">
          {options.map((option) => (
            <DropdownMenuItem key={option} onClick={() => onSelect(option)}>
              {option}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function TimetableCell({ entry, onClick }: { entry: Entry; onClick: () => void }) {
  const accent = accentFor(entry.subject)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full min-h-[64px] w-full flex-col overflow-hidden rounded-lg border border-border py-1.5 pl-3 pr-2 text-left transition-shadow hover:shadow-sm ${accent.bg}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${accent.bar}`} aria-hidden />
      <span className="text-[13px] font-semibold leading-tight text-foreground">{entry.subject}</span>
      {entry.teacher && (
        <span className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{entry.teacher}</span>
      )}
      {entry.room && (
        <span className="mt-0.5 flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          <span className="truncate">{entry.room}</span>
        </span>
      )}
    </button>
  )
}

function EmptyCell({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add class"
      className="group flex h-full min-h-[64px] w-full items-center justify-center rounded-lg border border-dashed border-transparent text-muted-foreground/40 transition-colors hover:border-border hover:bg-muted/40 hover:text-brand"
    >
      <Plus className="hidden size-4 group-hover:block" />
      <span className="text-sm group-hover:hidden" aria-hidden>
        —
      </span>
    </button>
  )
}
