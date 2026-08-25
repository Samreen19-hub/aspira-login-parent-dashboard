"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CHILDREN, type Child } from "@/lib/parent-data"

/**
 * Single source of truth for the signed-in parent's children.
 *
 * The whole roster (seeded sample children plus any the parent adds) is persisted to localStorage
 * so the same list drives My Children, the Parent Dashboard sidebar and the Timetable child
 * selector. Add/edit/delete all mutate this one list, so every consumer updates together and the
 * changes survive a refresh. This mirrors the social-store persistence pattern and keeps child
 * state from being duplicated across unrelated components.
 */
type ChildrenState = {
  /** The full roster, in display order. */
  children: Child[]
  hydrated: boolean
  /** Persist a new child and make it available everywhere children are listed. */
  addChild: (child: Child) => void
  /** Update an existing child's fields in place, everywhere it is shown. */
  updateChild: (id: string, updates: Partial<Child>) => void
  /** Remove a child from the roster everywhere it is shown. */
  deleteChild: (id: string) => void
}

const ChildrenContext = createContext<ChildrenState | null>(null)
const STORE_KEY = "aspira-parent-children"
/** Previous key that stored only parent-added children; migrated on first load so nothing is lost. */
const LEGACY_ADDED_KEY = "aspira-parent-added-children"

export function ChildrenStoreProvider({ children: node }: { children: ReactNode }) {
  // Start from the seeded roster so the very first render (pre-hydration) matches the sample data.
  const [list, setList] = useState<Child[]>(CHILDREN)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY)
      if (stored) {
        setList(JSON.parse(stored))
        return
      }
      // First run under the full-roster store: seed with the sample children, merging any children
      // added under the previous ("added children") key so earlier additions are preserved.
      let seeded = [...CHILDREN]
      const legacy = localStorage.getItem(LEGACY_ADDED_KEY)
      if (legacy) {
        const added: Child[] = JSON.parse(legacy)
        seeded = [...seeded, ...added.filter((a) => !seeded.some((s) => s.id === a.id))]
      }
      setList(seeded)
    } catch {
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORE_KEY, JSON.stringify(list))
  }, [hydrated, list])

  const value = useMemo<ChildrenState>(
    () => ({
      children: list,
      hydrated,
      addChild: (child: Child) =>
        setList((items) => (items.some((item) => item.id === child.id) ? items : [...items, child])),
      updateChild: (id: string, updates: Partial<Child>) =>
        setList((items) => items.map((item) => (item.id === id ? { ...item, ...updates } : item))),
      deleteChild: (id: string) => setList((items) => items.filter((item) => item.id !== id)),
    }),
    [list, hydrated],
  )

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>
}

export function useChildrenStore() {
  const value = useContext(ChildrenContext)
  if (!value) throw new Error("useChildrenStore must be used inside ChildrenStoreProvider")
  return value
}
