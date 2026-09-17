"use client"

/**
 * Parent → Timetable (FRONTEND-ONLY prototype).
 *
 * A flexible, parent-managed weekly timetable:
 *   Institution Type → Class → Section → editable weekly grid → Save.
 *
 * The grid is a recurring WEEKLY timetable (Mon–Sun by default), NOT a calendar.
 * The parent fully controls both rows (periods) and columns (days / custom
 * entries): add/delete rows, add/delete/rename columns, add an entire timetable
 * when none exists, and delete the whole timetable.
 *
 * Persistence is intentionally frontend-only (localStorage), keyed per
 * child + institution-type + class + section, so each combination keeps its own
 * state and survives refreshes. There is NO database, API, schema, or auth
 * coupling here — that arrives when the real School Admin backend is built.
 */

import { useEffect, useMemo, useRef, useState } from "react"
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
  X,
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

interface Column {
  id: string
  name: string
}

interface Row {
  id: string
  time: string
}

/** cells[rowId][colId] -> entry (or null for an empty slot). */
type Cells = Record<string, Record<string, Entry | null>>

interface Timetable {
  columns: Column[]
  rows: Row[]
  cells: Cells
}

const DEFAULT_DAYS: { id: string; name: string }[] = [
  { id: "mon", name: "Mon" },
  { id: "tue", name: "Tue" },
  { id: "wed", name: "Wed" },
  { id: "thu", name: "Thu" },
  { id: "fri", name: "Fri" },
  { id: "sat", name: "Sat" },
  { id: "sun", name: "Sun" },
]

const SEED_TIMES = [
  "8:00 AM – 8:45 AM",
  "8:45 AM – 9:30 AM",
  "9:45 AM – 10:30 AM",
  "10:30 AM – 11:15 AM",
  "11:30 AM – 12:15 PM",
  "12:15 PM – 1:00 PM",
  "1:45 PM – 2:30 PM",
  "2:30 PM – 3:15 PM",
]

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

/** A fresh weekly timetable: Mon–Sun columns + one blank row. */
function blankTimetable(): Timetable {
  const columns: Column[] = DEFAULT_DAYS.map((d) => ({ id: d.id, name: d.name }))
  const rows: Row[] = [{ id: "r1", time: "" }]
  const cells: Cells = { r1: {} }
  for (const col of columns) cells.r1[col.id] = null
  return { columns, rows, cells }
}

/**
 * Default timetable for a filter combination. Only the reference combination
 * (School · Class 8 · A) is seeded with sample classes; every other
 * combination has NO timetable until the parent adds one.
 */
function seedTimetable(type: InstitutionType, klass: string, section: string): Timetable | null {
  if (!(type === "school" && klass === "Class 8" && section === "A")) return null

  const columns: Column[] = DEFAULT_DAYS.map((d) => ({ id: d.id, name: d.name }))
  const rows: Row[] = SEED_TIMES.map((time, i) => ({ id: `r${i + 1}`, time: `${i + 1} · ${time}` }))
  const cells: Cells = {}
  const [start, end] = ["", ""]

  rows.forEach((row, rIndex) => {
    cells[row.id] = {}
    columns.forEach((col, cIndex) => {
      const seed = SCHOOL_SEED[rIndex]?.[cIndex]
      cells[row.id][col.id] = seed
        ? { subject: seed[0], teacher: seed[1], room: seed[2], start, end, notes: "" }
        : null
    })
  })

  return { columns, rows, cells }
}

/* -------------------------------------------------------------------------- */
/*  Persistence helpers                                                        */
/* -------------------------------------------------------------------------- */

const DELETED_MARKER = "__deleted__"

function storageKey(childId: string, type: InstitutionType, klass: string, section: string) {
  return `aspira:timetable:v2:${childId}:${type}:${klass}:${section}`
}

/** Returns the stored timetable, the "deleted" sentinel, or null if untouched. */
function readStore(key: string): Timetable | typeof DELETED_MARKER | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Timetable | { deleted: true }
    if ("deleted" in parsed && parsed.deleted) return DELETED_MARKER
    return parsed as Timetable
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

  // Month navigation (label only — the grid is a recurring weekly timetable).
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Timetable state + persistence bookkeeping.
  const [timetable, setTimetable] = useState<Timetable | null>(() => seedTimetable("school", "Class 8", "A"))
  const [dirty, setDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Monotonic id generator for dynamically added rows/columns.
  const idCounter = useRef(0)
  const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter.current++}`

  const key = storageKey(childId, type, klass, section)

  // Load the stored timetable (or a fresh seed) whenever the combination changes.
  useEffect(() => {
    const stored = readStore(key)
    if (stored === DELETED_MARKER) setTimetable(null)
    else if (stored) setTimetable(stored)
    else setTimetable(seedTimetable(type, klass, section))
    setDirty(false)
    setJustSaved(false)
  }, [key, type, klass, section])

  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  // Editing dialog.
  const [editing, setEditing] = useState<{ rowId: string; colId: string } | null>(null)
  const [form, setForm] = useState<Entry>({ subject: "", teacher: "", room: "", start: "", end: "", notes: "" })

  // Add-column dialog.
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnName, setNewColumnName] = useState("")

  // Delete-timetable confirmation.
  const [confirmDelete, setConfirmDelete] = useState(false)

  function markChanged() {
    setDirty(true)
    setJustSaved(false)
  }

  function openEditor(rowId: string, colId: string) {
    const existing = timetable?.cells[rowId]?.[colId]
    setForm(existing ?? { subject: "", teacher: "", room: "", start: "", end: "", notes: "" })
    setEditing({ rowId, colId })
  }

  function commitEntry() {
    if (!editing || !form.subject.trim()) return
    const { rowId, colId } = editing
    setTimetable((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        cells: {
          ...prev.cells,
          [rowId]: { ...prev.cells[rowId], [colId]: { ...form, subject: form.subject.trim() } },
        },
      }
    })
    markChanged()
    setEditing(null)
  }

  function deleteEntry() {
    if (!editing) return
    const { rowId, colId } = editing
    setTimetable((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        cells: { ...prev.cells, [rowId]: { ...prev.cells[rowId], [colId]: null } },
      }
    })
    markChanged()
    setEditing(null)
  }

  function updateRowTime(rowId: string, time: string) {
    setTimetable((prev) => {
      if (!prev) return prev
      return { ...prev, rows: prev.rows.map((r) => (r.id === rowId ? { ...r, time } : r)) }
    })
    markChanged()
  }

  function addRow() {
    setTimetable((prev) => {
      if (!prev) return prev
      const id = nextId("row")
      const rowCells: Record<string, Entry | null> = {}
      for (const col of prev.columns) rowCells[col.id] = null
      return { ...prev, rows: [...prev.rows, { id, time: "" }], cells: { ...prev.cells, [id]: rowCells } }
    })
    markChanged()
  }

  function deleteRow(rowId: string) {
    setTimetable((prev) => {
      if (!prev) return prev
      const cells = { ...prev.cells }
      delete cells[rowId]
      return { ...prev, rows: prev.rows.filter((r) => r.id !== rowId), cells }
    })
    markChanged()
  }

  function addColumn() {
    const name = newColumnName.trim()
    if (!name) return
    setTimetable((prev) => {
      if (!prev) return prev
      const id = nextId("col")
      const cells: Cells = {}
      for (const row of prev.rows) cells[row.id] = { ...prev.cells[row.id], [id]: null }
      return { ...prev, columns: [...prev.columns, { id, name }], cells }
    })
    markChanged()
    setNewColumnName("")
    setAddingColumn(false)
  }

  function deleteColumn(colId: string) {
    setTimetable((prev) => {
      if (!prev) return prev
      const cells: Cells = {}
      for (const row of prev.rows) {
        const rowCells = { ...prev.cells[row.id] }
        delete rowCells[colId]
        cells[row.id] = rowCells
      }
      return { ...prev, columns: prev.columns.filter((c) => c.id !== colId), cells }
    })
    markChanged()
  }

  function addTimetable() {
    setTimetable(blankTimetable())
    markChanged()
  }

  function deleteTimetable() {
    setTimetable(null)
    setConfirmDelete(false)
    // Persist the deletion immediately so a refresh keeps the empty state.
    try {
      window.localStorage.setItem(key, JSON.stringify({ deleted: true }))
    } catch {
      // Ignore storage failures (e.g. private mode); prototype persistence only.
    }
    setDirty(false)
    setJustSaved(false)
  }

  function saveTimetable() {
    try {
      if (timetable) window.localStorage.setItem(key, JSON.stringify(timetable))
      else window.localStorage.setItem(key, JSON.stringify({ deleted: true }))
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

  const editingExisting = editing ? Boolean(timetable?.cells[editing.rowId]?.[editing.colId]) : false
  const columnCount = timetable ? timetable.columns.length + 1 : 1

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
        {timetable && (
          <div className="ml-auto flex items-center gap-2">
            {dirty && <span className="text-xs font-medium text-amber-600">Unsaved changes</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="h-8 gap-1.5 rounded-lg text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Delete Timetable
            </Button>
          </div>
        )}
      </div>

      {timetable ? (
        <>
          {/* Timetable grid */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table
              className="w-full border-separate border-spacing-0 text-sm"
              style={{ minWidth: `${150 + timetable.columns.length * 150}px` }}
            >
              <caption className="sr-only">
                {`Weekly timetable for ${klass} section ${section}`}
              </caption>
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 min-w-[160px] border-b border-r border-border bg-muted/60 px-3 py-3 text-left text-xs font-semibold text-foreground">
                    Period / Time
                  </th>
                  {timetable.columns.map((col) => (
                    <th
                      key={col.id}
                      className="group min-w-[150px] border-b border-r border-border bg-muted/60 px-3 py-2 text-center last:border-r-0"
                      scope="col"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-semibold text-foreground">{col.name}</span>
                        <button
                          type="button"
                          onClick={() => deleteColumn(col.id)}
                          aria-label={`Remove ${col.name} column`}
                          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timetable.rows.map((row, rIndex) => (
                  <tr key={row.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 min-w-[160px] border-b border-r border-border bg-card px-2 py-2 text-left align-top"
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                          {rIndex + 1}
                        </span>
                        <Input
                          value={row.time}
                          onChange={(e) => updateRowTime(row.id, e.target.value)}
                          placeholder="e.g. 8:00 AM – 8:45 AM"
                          aria-label={`Time for period ${rIndex + 1}`}
                          className="h-8 flex-1 text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => deleteRow(row.id)}
                          aria-label={`Delete period ${rIndex + 1}`}
                          className="mt-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </th>
                    {timetable.columns.map((col) => {
                      const entry = timetable.cells[row.id]?.[col.id]
                      return (
                        <td
                          key={col.id}
                          className="border-b border-r border-border p-1.5 align-top last:border-r-0"
                        >
                          {entry ? (
                            <TimetableCell entry={entry} onClick={() => openEditor(row.id, col.id)} />
                          ) : (
                            <EmptyCell onClick={() => openEditor(row.id, col.id)} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={columnCount} className="border-t border-border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={addRow} className="h-9 gap-1.5 rounded-lg">
                        <Plus className="size-4" />
                        Add Row
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingColumn(true)}
                        className="h-9 gap-1.5 rounded-lg"
                      >
                        <Plus className="size-4" />
                        Add Column
                      </Button>
                    </div>
                  </td>
                </tr>
              </tfoot>
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
        </>
      ) : (
        /* Empty state — no timetable for this combination yet */
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Info className="size-6" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-foreground">No timetable added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a weekly timetable for {klass} · Section {section}.
            </p>
          </div>
          <Button onClick={addTimetable} className="gap-2 rounded-xl">
            <Plus className="size-4" />
            Add Timetable
          </Button>
        </div>
      )}

      {/* Edit / add class dialog */}
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

      {/* Add-column dialog */}
      <Dialog
        open={addingColumn}
        onOpenChange={(open) => {
          if (!open) {
            setAddingColumn(false)
            setNewColumnName("")
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add column</DialogTitle>
            <DialogDescription>Name the new day or custom column (e.g. Holiday, Lab Day).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="tt-col-name">Column name</Label>
            <Input
              id="tt-col-name"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) addColumn()
              }}
              placeholder="e.g. Holiday"
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={addColumn} disabled={!newColumnName.trim()}>
              Add Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-timetable confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this timetable?</DialogTitle>
            <DialogDescription>
              This will remove the entire timetable. You can add a new one later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={deleteTimetable} className="gap-2 bg-destructive text-white hover:bg-destructive/90">
              <Trash2 className="size-4" />
              Delete Timetable
            </Button>
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
