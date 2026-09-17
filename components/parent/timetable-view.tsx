"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Info,
  CalendarX2,
  School,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useChildrenStore } from "@/components/parent/children-store"
import {
  getDemoInstitutions,
  getSubjectMeta,
  type DemoClass,
  type DemoInstitution,
  type WeekdayName,
} from "@/lib/demo-academics"

/* -------------------------------------------------------------------------- */
/*  Date + school-hours helpers                                                */
/* -------------------------------------------------------------------------- */

/** Weekday name for a Date's `getDay()` index (0 = Sunday). Weekends are null. */
const WEEKDAY_BY_INDEX: (WeekdayName | null)[] = [
  null, // Sunday
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  null, // Saturday
]

/** Monday-first column headers for the month grid. */
const DOW_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/** Parse a human time like "8:00 AM" into minutes since midnight. */
function timeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let hours = Number(match[1]) % 12
  const minutes = Number(match[2])
  if (match[3].toUpperCase() === "PM") hours += 12
  return hours * 60 + minutes
}

/** School/college hours for a day, e.g. "8:00 AM – 11:25 AM", from its classes. */
function dayHours(classes: DemoClass[]): string {
  if (!classes.length) return ""
  const starts = classes.map((c) => timeToMinutes(c.start))
  const ends = classes.map((c) => timeToMinutes(c.end))
  const first = classes[starts.indexOf(Math.min(...starts))].start
  const last = classes[ends.indexOf(Math.max(...ends))].end
  return `${first} – ${last}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  )
}

/** Build the Monday-first weeks (each 7 days) overlapping the given month. */
function buildMonthMatrix(viewDate: Date): Date[][] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  const mondayOffset = (first.getDay() + 6) % 7 // 0 = Monday … 6 = Sunday
  const cursor = new Date(year, month, 1 - mondayOffset)
  const lastDay = new Date(year, month + 1, 0)

  const weeks: Date[][] = []
  while (cursor <= lastDay) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

/* -------------------------------------------------------------------------- */
/*  Timetable view                                                             */
/* -------------------------------------------------------------------------- */

export function TimetableView() {
  // Children come from the shared, DB-backed store so newly added children appear here too.
  const { children } = useChildrenStore()
  // When navigating in from a specific child (My Children → Timetable), that child's id arrives
  // as `?childId=`. Seed the initial selection from it; manual selection overrides afterwards.
  const searchParams = useSearchParams()
  const initialChildId = searchParams.get("childId")
  const [selectedId, setSelectedId] = useState<string | null>(initialChildId)

  const activeChild = children.find((child) => child.id === selectedId) ?? children[0]

  // Timetable data is DEMO/UI-only and matched by child name (see lib/demo-academics).
  const institutions = useMemo<DemoInstitution[]>(
    () => (activeChild ? getDemoInstitutions(activeChild.name) : []),
    [activeChild],
  )

  return (
    <div className="mx-auto max-w-6xl">
      {/* Heading */}
      <div className="mb-6">
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
        <p className="mt-1 text-sm text-muted-foreground">A clear view of your children&apos;s school week.</p>
      </div>

      {/* Child selector */}
      <div className="mb-6">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="h-12 justify-between gap-3 rounded-xl px-3 sm:w-64">
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
          <DropdownMenuContent className="w-64">
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
      </div>

      {/* Body: one labelled timetable context per institution, or the empty state */}
      {institutions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-8">
          {institutions.map((institution) => (
            <InstitutionTimetable key={institution.id} institution={institution} />
          ))}
        </div>
      )}

      {/* Footer notes */}
      <div className="mt-8 flex flex-col items-center gap-1 text-center">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Info className="size-4" />
          Timetable is subject to change. Please check regularly for updates.
        </p>
        <p className="text-xs text-muted-foreground">
          Timetable is managed by your school. Contact the school for timetable changes.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Per-institution timetable (academic year + monthly calendar)               */
/* -------------------------------------------------------------------------- */

function InstitutionTimetable({ institution }: { institution: DemoInstitution }) {
  const isUniversity = institution.type === "university"
  const [yearIndex, setYearIndex] = useState(0)
  const activeYear = institution.years[yearIndex] ?? institution.years[0]

  // The visible month; navigation shifts it by ±1 month. Start on the current month.
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())

  const weeks = useMemo(() => buildMonthMatrix(viewDate), [viewDate])
  const monthLabel = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`

  function classesForDate(date: Date): DemoClass[] {
    const weekday = WEEKDAY_BY_INDEX[date.getDay()]
    if (!weekday) return []
    return activeYear.weekly[weekday] ?? []
  }

  function shiftMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  const selectedInMonth =
    selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear()
  const selectedClasses = selectedInMonth ? classesForDate(selectedDate) : []
  const Label = isUniversity ? GraduationCap : School

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Context header: institution + academic year / class / section */}
      <div className="flex flex-col gap-4 border-b border-border bg-brand-muted/30 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
            <Label className="size-5" />
          </span>
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              {isUniversity ? "University Timetable" : "School Timetable"}
              <Badge variant="secondary" className="font-normal">
                Demo data
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">
              {isUniversity ? "University" : "School"}: {institution.name}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">Academic year {activeYear.year}</Badge>
              <Badge variant="outline">{isUniversity ? "Year" : "Class"}: {activeYear.level}</Badge>
              <Badge variant="outline">Section: {activeYear.section}</Badge>
            </div>
          </div>
        </div>

        {/* Academic-year selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="h-11 shrink-0 justify-between gap-2 rounded-xl px-3 sm:w-52">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-brand" />
                  <span className="font-medium text-foreground">{activeYear.year}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-52">
            {institution.years.map((year, index) => (
              <DropdownMenuItem key={year.year} onClick={() => setYearIndex(index)} className="gap-2 py-2">
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Academic year {year.year}</span>
                  <span className="text-xs text-muted-foreground">
                    {isUniversity ? "Year" : "Class"} {year.level} · Section {year.section}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <Button
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="font-display text-base font-semibold text-foreground" aria-live="polite">
          {monthLabel}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-10 rounded-xl"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Monthly calendar grid */}
      <div className="p-4">
        <div className="grid grid-cols-7 gap-1.5">
          {DOW_HEADERS.map((label) => (
            <div key={label} className="pb-1 text-center text-xs font-semibold text-muted-foreground">
              {label}
            </div>
          ))}
          {weeks.flat().map((date) => {
            const inMonth = date.getMonth() === viewDate.getMonth()
            const classes = classesForDate(date)
            const isSelected = isSameDay(date, selectedDate)
            const isToday = isSameDay(date, new Date())
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDate(new Date(date))}
                aria-pressed={isSelected}
                className={[
                  "flex min-h-16 flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors sm:min-h-20",
                  inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground",
                  isSelected ? "border-brand ring-1 ring-brand" : "border-border hover:border-brand/50",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-xs font-medium",
                    isToday ? "grid size-5 place-items-center rounded-full bg-brand text-brand-foreground" : "",
                    !inMonth ? "text-muted-foreground" : "text-foreground",
                  ].join(" ")}
                >
                  {date.getDate()}
                </span>
                <span className="flex flex-col gap-0.5">
                  {classes.slice(0, 2).map((entry, i) => {
                    const meta = getSubjectMeta(entry.subject)
                    return (
                      <span
                        key={i}
                        className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${meta.tone}`}
                      >
                        {entry.subject}
                      </span>
                    )
                  })}
                  {classes.length > 2 && (
                    <span className="px-1 text-[10px] font-medium text-muted-foreground">
                      +{classes.length - 2} more
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="border-t border-border p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
            <CalendarDays className="size-4 text-brand" />
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {selectedClasses.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" />
              {dayHours(selectedClasses)}
            </p>
          )}
        </div>

        {selectedClasses.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {selectedClasses.map((entry, i) => (
              <SubjectCard key={i} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No classes scheduled on this day.
          </div>
        )}
      </div>
    </Card>
  )
}

function SubjectCard({ entry }: { entry: DemoClass }) {
  const meta = getSubjectMeta(entry.subject)
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-shadow hover:shadow-sm">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{entry.subject}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {entry.start} – {entry.end}
        </p>
        <p className="text-sm text-muted-foreground">{entry.room}</p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state                                                                */
/* -------------------------------------------------------------------------- */

function EmptyState() {
  return (
    <Card className="items-center gap-3 p-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
        <CalendarX2 className="size-7" />
      </span>
      <h2 className="font-display text-lg font-semibold text-foreground">No timetable available</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your school has not published a timetable for this child yet.
      </p>
    </Card>
  )
}
