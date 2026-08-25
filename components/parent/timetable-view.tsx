"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  CalendarX2,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  WEEKDAYS,
  dateForWeekday,
  formatDate,
  formatWeekRange,
  getChildTimetable,
  getSubjectMeta,
  startOfWeek,
  weekKey,
  type TimetableEntry,
} from "@/lib/timetable-data"

/* -------------------------------------------------------------------------- */
/*  School-hours helpers (derived from the day's entries)                      */
/* -------------------------------------------------------------------------- */

/** Parse a human time like "8:00 AM" into minutes since midnight. */
function timeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return 0
  let hours = Number(match[1]) % 12
  const minutes = Number(match[2])
  if (match[3].toUpperCase() === "PM") hours += 12
  return hours * 60 + minutes
}

/** School hours for a day, e.g. "8:00 AM – 3:00 PM", computed from its entries. */
function schoolHours(entries: TimetableEntry[]): string {
  if (!entries.length) return ""
  const starts = entries.map((entry) => timeToMinutes(entry.start))
  const ends = entries.map((entry) => timeToMinutes(entry.end))
  const first = entries[starts.indexOf(Math.min(...starts))].start
  const last = entries[ends.indexOf(Math.max(...ends))].end
  return `${first} – ${last}`
}

/* -------------------------------------------------------------------------- */
/*  Timetable view                                                             */
/* -------------------------------------------------------------------------- */

export function TimetableView() {
  // Children come from the shared, persisted store so newly added children appear here too.
  const { children } = useChildrenStore()
  // When navigating in from a specific child (e.g. My Children → Timetable), that child's id
  // arrives as `?childId=`. Seed the initial selection from it so the page opens on that child
  // instead of always defaulting to the first one. Manual selection still overrides it afterwards.
  const searchParams = useSearchParams()
  const initialChildId = searchParams.get("childId")
  const [selectedId, setSelectedId] = useState<string | null>(initialChildId)
  // Track the Monday of the visible week; navigation shifts it by ±7 days.
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))

  // Resolve the selected child; fall back to the first child when nothing is selected or the
  // selected/param id is not a valid child in the roster.
  const activeChild = children.find((child) => child.id === selectedId) ?? children[0]
  const childId = activeChild?.id ?? ""
  const key = weekKey(weekStart)

  const { data, isLoading } = useSWR(
    childId ? ["timetable", childId, key] : null,
    () => getChildTimetable(childId, key),
    { keepPreviousData: false },
  )

  function shiftWeek(deltaWeeks: number) {
    setWeekStart((current) => {
      const next = new Date(current)
      next.setDate(next.getDate() + deltaWeeks * 7)
      return startOfWeek(next)
    })
  }

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>()
    for (const entry of data ?? []) {
      const list = map.get(entry.day) ?? []
      list.push(entry)
      map.set(entry.day, list)
    }
    // Keep each day ordered by start time.
    for (const list of map.values()) {
      list.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    }
    return map
  }, [data])

  const hasTimetable = Array.isArray(data) && data.length > 0

  return (
    <div className="mx-auto max-w-6xl">
      {/* Heading — back arrow reuses the exact Groups/Communities back-navigation pattern
          (Link + ArrowLeft size-4 + text-brand hover:underline), arrow only. */}
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

      {/* Controls: child selector + week navigation */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="h-12 justify-between gap-3 rounded-xl px-3 sm:w-64">
                <span className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarImage src={activeChild?.avatar || "/placeholder.svg"} alt={activeChild?.name} />
                    <AvatarFallback>{activeChild?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-foreground">{activeChild?.name}</span>
                </span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-64">
            {children.map((child) => (
              <DropdownMenuItem
                key={child.id}
                onClick={() => setSelectedId(child.id)}
                className="gap-2.5 py-2"
              >
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

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex h-11 items-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium text-foreground shadow-sm">
            <CalendarDays className="size-4 text-brand" />
            <span aria-live="polite">{formatWeekRange(weekStart)}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <LoadingState />
      ) : !hasTimetable ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {WEEKDAYS.map((day) => {
            const entries = entriesByDay.get(day) ?? []
            const date = dateForWeekday(weekStart, day)
            return <DayRow key={day} day={day} date={date} entries={entries} />
          })}
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
/*  Day row                                                                    */
/* -------------------------------------------------------------------------- */

function DayRow({ day, date, entries }: { day: string; date: Date; entries: TimetableEntry[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-0 md:grid-cols-[minmax(180px,220px)_1fr]">
        {/* Day label column */}
        <div className="flex flex-col justify-center gap-1.5 border-b border-border bg-brand-muted/40 p-5 md:border-b-0 md:border-r">
          <p className="font-display text-lg font-bold text-brand">{day}</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {formatDate(date)}
          </p>
          {entries.length > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" />
              {schoolHours(entries)}
            </p>
          )}
        </div>

        {/* Subject cards */}
        <div className="p-4">
          {entries.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <SubjectCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-20 items-center justify-center rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No classes scheduled
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

function SubjectCard({ entry }: { entry: TimetableEntry }) {
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
/*  Loading / empty states                                                     */
/* -------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      {WEEKDAYS.map((day) => (
        <Card key={day} className="overflow-hidden p-0">
          <div className="grid gap-0 md:grid-cols-[minmax(180px,220px)_1fr]">
            <div className="flex flex-col justify-center gap-2 border-b border-border bg-brand-muted/40 p-5 md:border-b-0 md:border-r">
              <div className="h-5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          </div>
        </Card>
      ))}
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading timetable…
      </p>
    </div>
  )
}

function EmptyState() {
  return (
    <Card className="items-center gap-3 p-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
        <CalendarX2 className="size-7" />
      </span>
      <h2 className="font-display text-lg font-semibold text-foreground">No timetable available</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your school has not published a timetable for this week yet.
      </p>
    </Card>
  )
}
