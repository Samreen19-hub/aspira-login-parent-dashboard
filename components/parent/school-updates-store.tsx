"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useChildrenStore } from "@/components/parent/children-store"
import { SCHOOL_UPDATES, updatesForSchools, type SchoolUpdate } from "@/lib/school-updates"

/**
 * Single source of truth for School Updates on the parent side.
 *
 * The published notices (from the School Admin Dashboard) are scoped to the schools the parent's
 * children actually attend — derived live from the children store — and sorted newest-first. The
 * same list powers the right-sidebar "School Notifications" preview and the `/parent/school-updates`
 * page, so there is never a duplicate notice store.
 *
 * Read/unread state is persisted to localStorage (a set of read notice ids), mirroring the
 * feed/children store persistence pattern. Opening an update marks it read.
 */
type SchoolUpdatesState = {
  /** Notices for the parent's child's school(s), newest first. */
  updates: SchoolUpdate[]
  /**
   * The distinct schools the parent's children attend, derived live from the children store and
   * sorted alphabetically. Drives the dynamic School Updates filter options — never hardcoded.
   */
  schools: string[]
  /** Count of unread notices in `updates`. */
  unreadCount: number
  hydrated: boolean
  isRead: (id: string) => boolean
  markRead: (id: string) => void
  markAllRead: () => void
}

const SchoolUpdatesContext = createContext<SchoolUpdatesState | null>(null)
const READ_KEY = "aspira-parent-school-updates-read"

export function SchoolUpdatesStoreProvider({ children }: { children: ReactNode }) {
  const { children: roster } = useChildrenStore()
  const [readIds, setReadIds] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(READ_KEY)
      if (stored) setReadIds(JSON.parse(stored))
    } catch {
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(READ_KEY, JSON.stringify(readIds))
  }, [hydrated, readIds])

  // The schools the parent has access to, via Parent → Child → School. Adding or removing a child
  // (or changing a child's school) updates this list, so the filter options stay in sync and a
  // removed child/school relationship immediately drops that school's access.
  const schools = useMemo(
    () => Array.from(new Set(roster.map((child) => child.school))).sort((a, b) => a.localeCompare(b)),
    [roster],
  )

  // Scope to the schools of the parent's current children (kept in sync as children are added/removed).
  const updates = useMemo(() => updatesForSchools(SCHOOL_UPDATES, schools), [schools])

  const value = useMemo<SchoolUpdatesState>(() => {
    const readSet = new Set(readIds)
    return {
      updates,
      schools,
      unreadCount: updates.filter((update) => !readSet.has(update.id)).length,
      hydrated,
      isRead: (id: string) => readSet.has(id),
      markRead: (id: string) => setReadIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
      markAllRead: () => setReadIds((ids) => Array.from(new Set([...ids, ...updates.map((u) => u.id)]))),
    }
  }, [updates, schools, readIds, hydrated])

  return <SchoolUpdatesContext.Provider value={value}>{children}</SchoolUpdatesContext.Provider>
}

export function useSchoolUpdatesStore() {
  const value = useContext(SchoolUpdatesContext)
  if (!value) throw new Error("useSchoolUpdatesStore must be used inside SchoolUpdatesStoreProvider")
  return value
}
