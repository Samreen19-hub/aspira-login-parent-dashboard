"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import { useSession } from "@/lib/auth-client"
import type { Child } from "@/lib/parent-data"
import {
  addChild as addChildAction,
  deleteChild as deleteChildAction,
  listChildren,
  updateChild as updateChildAction,
  type ChildInput,
} from "@/app/actions/children"

/**
 * Single source of truth for the signed-in parent's children.
 *
 * The DATABASE is authoritative now: the roster comes from `public.parent_child`
 * via `listChildren` (server action), scoped to the Better Auth session user, so
 * it survives refresh, logout/login, and other devices. There is NO localStorage
 * source of truth anymore. Add/edit/delete persist to the DB and then revalidate
 * this one SWR cache, so My Children, the Parent Dashboard sidebar and the
 * Timetable child selector all update together.
 */
type ChildrenState = {
  /** The full roster, in display order (oldest first). */
  children: Child[]
  /** True once the initial server load has resolved. */
  hydrated: boolean
  /** Persist a new child; the DB assigns its id. */
  addChild: (input: ChildInput) => Promise<void>
  /** Update an existing child's fields, everywhere it is shown. */
  updateChild: (id: string, updates: Partial<ChildInput>) => Promise<void>
  /** Remove a child from the roster everywhere it is shown. */
  deleteChild: (id: string) => Promise<void>
}

const ChildrenContext = createContext<ChildrenState | null>(null)

export function ChildrenStoreProvider({ children: node }: { children: ReactNode }) {
  // Scope the query to the signed-in user's id so a different user's cached
  // roster is never reused after login/logout. Until the session resolves
  // (userId null) the key is null, so nothing is fetched.
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  const { data, mutate } = useSWR(
    userId ? ["children", userId] : null,
    () => listChildren(),
    { revalidateOnFocus: false },
  )

  const value = useMemo<ChildrenState>(() => {
    const list = data ?? []
    return {
      children: list,
      hydrated: data !== undefined,
      addChild: async (input: ChildInput) => {
        await addChildAction(input)
        await mutate()
      },
      updateChild: async (id: string, updates: Partial<ChildInput>) => {
        await updateChildAction(id, updates)
        await mutate()
      },
      deleteChild: async (id: string) => {
        await deleteChildAction(id)
        await mutate()
      },
    }
  }, [data, mutate])

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>
}

export function useChildrenStore() {
  const value = useContext(ChildrenContext)
  if (!value) throw new Error("useChildrenStore must be used inside ChildrenStoreProvider")
  return value
}
