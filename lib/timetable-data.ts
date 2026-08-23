/**
 * Timetable data layer for the Parent dashboard.
 *
 * The data is modelled as `childId -> weekKey -> entries[]` so that each child has an
 * independent, per-week timetable. The Parent UI only ever *reads* from this layer through
 * `getChildTimetable`. When the School Admin experience is built later, it can write into the
 * same `childId -> weekKey -> entries` shape (replacing the seeded mock below) and those changes
 * will flow into the Parent page with no UI changes required.
 *
 * `weekKey` is the ISO date (YYYY-MM-DD) of the Monday of a given week, so any Date within a week
 * resolves to the same key.
 */

import {
  Calculator,
  BookOpen,
  Bot,
  FlaskConical,
  Palette,
  Dumbbell,
  Landmark,
  Library,
  Music,
  Globe2,
  type LucideIcon,
} from "lucide-react"

export type WeekdayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday"

export const WEEKDAYS: WeekdayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

export interface TimetableEntry {
  id: string
  day: WeekdayName
  subject: string
  /** Human-readable start time, e.g. "8:00 AM". */
  start: string
  /** Human-readable end time, e.g. "10:00 AM". */
  end: string
  /** Room or location, e.g. "Room 101" or "Sports Ground". */
  room: string
}

/** Visual metadata for a subject: a simple icon and a soft colour tile matching the dashboard. */
export interface SubjectMeta {
  icon: LucideIcon
  tone: string
}

const DEFAULT_SUBJECT_META: SubjectMeta = { icon: BookOpen, tone: "bg-muted text-muted-foreground" }

const SUBJECT_META: Record<string, SubjectMeta> = {
  Mathematics: { icon: Calculator, tone: "bg-violet-100 text-violet-600" },
  English: { icon: BookOpen, tone: "bg-emerald-100 text-emerald-600" },
  Robotics: { icon: Bot, tone: "bg-amber-100 text-amber-600" },
  Science: { icon: FlaskConical, tone: "bg-sky-100 text-sky-600" },
  Art: { icon: Palette, tone: "bg-rose-100 text-rose-600" },
  "Physical Education": { icon: Dumbbell, tone: "bg-teal-100 text-teal-600" },
  History: { icon: Landmark, tone: "bg-orange-100 text-orange-600" },
  Library: { icon: Library, tone: "bg-blue-100 text-blue-600" },
  Music: { icon: Music, tone: "bg-fuchsia-100 text-fuchsia-600" },
  Geography: { icon: Globe2, tone: "bg-cyan-100 text-cyan-600" },
}

export function getSubjectMeta(subject: string): SubjectMeta {
  return SUBJECT_META[subject] ?? DEFAULT_SUBJECT_META
}

/* -------------------------------------------------------------------------- */
/*  Week / date helpers                                                        */
/* -------------------------------------------------------------------------- */

/** Returns a new Date at midnight on the Monday of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday ... 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day // shift back to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** ISO key (YYYY-MM-DD) for the Monday of the week containing `date`. */
export function weekKey(date: Date): string {
  const monday = startOfWeek(date)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, "0")
  const d = String(monday.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** The date of a given weekday within the week starting at `weekStart` (Monday). */
export function dateForWeekday(weekStart: Date, weekday: WeekdayName): Date {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + WEEKDAYS.indexOf(weekday))
  return d
}

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }

/** e.g. "Aug 18, 2025". */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", DATE_FMT)
}

/** e.g. "Aug 18 – Aug 24, 2025" for the week that `weekStart` (a Monday) belongs to. */
export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const start = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const endStr = end.toLocaleDateString("en-US", DATE_FMT)
  return `${start} – ${endStr}`
}

/* -------------------------------------------------------------------------- */
/*  Mock timetable database                                                    */
/* -------------------------------------------------------------------------- */

type WeeklyTemplate = Omit<TimetableEntry, "id">[]

/** Aarav Kapoor (Class 6) — matches the reference timetable. */
const AARAV_TEMPLATE: WeeklyTemplate = [
  { day: "Monday", subject: "Mathematics", start: "8:00 AM", end: "10:00 AM", room: "Room 101" },
  { day: "Monday", subject: "English", start: "10:30 AM", end: "12:30 PM", room: "Room 102" },
  { day: "Monday", subject: "Robotics", start: "1:15 PM", end: "3:00 PM", room: "Lab 2" },
  { day: "Tuesday", subject: "Science", start: "8:00 AM", end: "10:00 AM", room: "Room 103" },
  { day: "Tuesday", subject: "Art", start: "10:30 AM", end: "12:30 PM", room: "Art Room" },
  { day: "Tuesday", subject: "Physical Education", start: "1:15 PM", end: "3:00 PM", room: "Sports Ground" },
  { day: "Wednesday", subject: "History", start: "8:00 AM", end: "10:00 AM", room: "Room 104" },
  { day: "Wednesday", subject: "Mathematics", start: "10:30 AM", end: "12:30 PM", room: "Room 101" },
  { day: "Wednesday", subject: "Library", start: "1:15 PM", end: "3:00 PM", room: "Library" },
  { day: "Thursday", subject: "Science", start: "8:00 AM", end: "10:00 AM", room: "Room 103" },
  { day: "Thursday", subject: "English", start: "10:30 AM", end: "12:30 PM", room: "Room 102" },
  { day: "Thursday", subject: "Music", start: "1:15 PM", end: "3:00 PM", room: "Music Room" },
  { day: "Friday", subject: "Robotics", start: "8:00 AM", end: "10:00 AM", room: "Lab 2" },
  { day: "Friday", subject: "Physical Education", start: "10:30 AM", end: "12:30 PM", room: "Sports Ground" },
  { day: "Friday", subject: "Geography", start: "1:15 PM", end: "3:00 PM", room: "Room 105" },
]

/** Saanvi Kapoor (Class 3) — an independent, clearly different timetable. */
const SAANVI_TEMPLATE: WeeklyTemplate = [
  { day: "Monday", subject: "English", start: "8:30 AM", end: "10:00 AM", room: "Room 12" },
  { day: "Monday", subject: "Art", start: "10:30 AM", end: "12:00 PM", room: "Art Room" },
  { day: "Monday", subject: "Music", start: "12:45 PM", end: "2:00 PM", room: "Music Room" },
  { day: "Tuesday", subject: "Mathematics", start: "8:30 AM", end: "10:00 AM", room: "Room 12" },
  { day: "Tuesday", subject: "Science", start: "10:30 AM", end: "12:00 PM", room: "Lab 1" },
  { day: "Tuesday", subject: "Library", start: "12:45 PM", end: "2:00 PM", room: "Library" },
  { day: "Wednesday", subject: "English", start: "8:30 AM", end: "10:00 AM", room: "Room 12" },
  { day: "Wednesday", subject: "Physical Education", start: "10:30 AM", end: "12:00 PM", room: "Sports Ground" },
  { day: "Wednesday", subject: "Art", start: "12:45 PM", end: "2:00 PM", room: "Art Room" },
  { day: "Thursday", subject: "Mathematics", start: "8:30 AM", end: "10:00 AM", room: "Room 12" },
  { day: "Thursday", subject: "Geography", start: "10:30 AM", end: "12:00 PM", room: "Room 14" },
  { day: "Thursday", subject: "Music", start: "12:45 PM", end: "2:00 PM", room: "Music Room" },
  { day: "Friday", subject: "Science", start: "8:30 AM", end: "10:00 AM", room: "Lab 1" },
  { day: "Friday", subject: "English", start: "10:30 AM", end: "12:00 PM", room: "Room 12" },
  { day: "Friday", subject: "Physical Education", start: "12:45 PM", end: "2:00 PM", room: "Sports Ground" },
]

/**
 * Publish a template into `weekKey -> entries` for a set of week offsets relative to the current
 * week (0 = this week, -1 = last week, 2 = two weeks ahead, ...). Weeks outside this range are
 * intentionally left unpublished so the Parent UI can demonstrate its "no timetable" state.
 */
function publishWeeks(template: WeeklyTemplate, offsets: number[]): Record<string, TimetableEntry[]> {
  const base = startOfWeek(new Date())
  const out: Record<string, TimetableEntry[]> = {}
  for (const offset of offsets) {
    const weekStart = new Date(base)
    weekStart.setDate(weekStart.getDate() + offset * 7)
    const key = weekKey(weekStart)
    out[key] = template.map((entry, index) => ({ ...entry, id: `${key}-${index}` }))
  }
  return out
}

const PUBLISHED_OFFSETS = [-2, -1, 0, 1, 2, 3]

/** The mock "database": childId -> weekKey -> entries. Replaceable by a real School Admin source. */
const TIMETABLE_DB: Record<string, Record<string, TimetableEntry[]>> = {
  aarav: publishWeeks(AARAV_TEMPLATE, PUBLISHED_OFFSETS),
  saanvi: publishWeeks(SAANVI_TEMPLATE, PUBLISHED_OFFSETS),
}

/**
 * Read a child's timetable for a given week.
 * - Returns an array of entries when the school has published that week.
 * - Returns `null` when no timetable exists for that child/week (drives the empty state).
 *
 * Async to model the future backend/School Admin source; the Parent UI awaits it and shows a
 * loading state meanwhile.
 */
export async function getChildTimetable(childId: string, key: string): Promise<TimetableEntry[] | null> {
  // Simulated latency so the loading state is real and the boundary matches a future fetch.
  await new Promise((resolve) => setTimeout(resolve, 250))
  return TIMETABLE_DB[childId]?.[key] ?? null
}
