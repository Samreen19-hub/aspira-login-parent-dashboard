"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { CHILDREN, type Child } from "@/lib/parent-data"

/**
 * Single source of truth for the signed-in parent's children.
 *
 * The seeded roster lives in `CHILDREN` (sample data). Children the parent adds through the
 * "Add Another Child" flow are persisted to localStorage and merged after the seeded ones, so the
 * same list drives My Children and the Timetable child selector. This mirrors the social-store
 * persistence pattern and keeps child state from being duplicated across unrelated components.
 */
type ChildrenState = {
  /** Seeded children first, then any the parent has added. */
  children: Child[]
  hydrated: boolean
  /** Persist a new child and make it available everywhere children are listed. */
  addChild: (child: Child) => void
}

const ChildrenContext = createContext<ChildrenState | null>(null)
const ADDED_KEY = "aspira-parent-added-children"

export function ChildrenStoreProvider({ children: node }: { children: ReactNode }) {
  const [added, setAdded] = useState<Child[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const value = localStorage.getItem(ADDED_KEY)
      if (value) setAdded(JSON.parse(value))
    } catch {} finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(ADDED_KEY, JSON.stringify(added))
  }, [hydrated, added])

  const value = useMemo<ChildrenState>(() => {
    // Seeded roster first, then added children (so the example order Aarav, Saanvi, Aanya holds).
    const list = [...CHILDREN, ...added]
    return {
      children: list,
      hydrated,
      addChild: (child: Child) =>
        setAdded((items) => (items.some((item) => item.id === child.id) ? items : [...items, child])),
    }
  }, [added, hydrated])

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>
}

export function useChildrenStore() {
  const value = useContext(ChildrenContext)
  if (!value) throw new Error("useChildrenStore must be used inside ChildrenStoreProvider")
  return value
}
