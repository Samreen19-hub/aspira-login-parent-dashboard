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

  // Scope to the schools of the parent's current children (kept in sync as children are added/removed).
  const updates = useMemo(() => {
    const schools = Array.from(new Set(roster.map((child) => child.school)))
    return updatesForSchools(SCHOOL_UPDATES, schools)
  }, [roster])

  const value = useMemo<SchoolUpdatesState>(() => {
    const readSet = new Set(readIds)
    return {
      updates,
      unreadCount: updates.filter((update) => !readSet.has(update.id)).length,
      hydrated,
      isRead: (id: string) => readSet.has(id),
      markRead: (id: string) => setReadIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
      markAllRead: () => setReadIds((ids) => Array.from(new Set([...ids, ...updates.map((u) => u.id)]))),
    }
  }, [updates, readIds, hydrated])

  return <SchoolUpdatesContext.Provider value={value}>{children}</SchoolUpdatesContext.Provider>
}

export function useSchoolUpdatesStore() {
  const value = useContext(SchoolUpdatesContext)
  if (!value) throw new Error("useSchoolUpdatesStore must be used inside SchoolUpdatesStoreProvider")
  return value
}
