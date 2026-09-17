"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import { useAuth } from "@/lib/auth-context"
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
 * The DATABASE is authoritative: the roster comes from `public.parent_child`
 * via `listChildren` (server action), scoped to the Better Auth session user, so
 * it survives refresh, logout/login, and other devices. There is NO localStorage
 * source of truth. Add/edit/delete persist to the DB and then revalidate this
 * one SWR cache, so My Children, the Parent Dashboard sidebar and the Timetable
 * child selector all update together.
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
  // Gate the query on the app's own (server-verified) auth session rather than
  // Better Auth's client `useSession()` hook. `useAuth()` resolves the user from
  // the cookie via a server action, which is reliable inside the v0 preview
  // iframe; the client-side get-session fetch could stay null on a hard refresh,
  // which previously left a just-added child invisible until the next sign-in.
  const { user, isReady } = useAuth()
  const userId = user?.id ?? null

  // Key by user id so a different user's cached roster is never reused after
  // login/logout. Until we have a user (key null) nothing is fetched.
  const { data, mutate } = useSWR(
    userId ? ["children", userId] : null,
    () => listChildren(),
    { revalidateOnFocus: false },
  )

  const value = useMemo<ChildrenState>(() => {
    const list = data ?? []
    return {
      children: list,
      // Loaded once the session has resolved and — when signed in — the first
      // roster fetch has returned. Signed-out resolves immediately to empty.
      hydrated: isReady && (userId === null || data !== undefined),
      addChild: async (input: ChildInput) => {
        const created = await addChildAction(input)
        // Show it immediately, then reconcile against the DB (source of truth),
        // so it never depends on refetch timing or a refresh to appear.
        await mutate((current) => [...(current ?? []), created], { revalidate: true })
      },
      updateChild: async (id: string, updates: Partial<ChildInput>) => {
        const updated = await updateChildAction(id, updates)
        await mutate(
          (current) => (current ?? []).map((child) => (child.id === id ? updated ?? child : child)),
          { revalidate: true },
        )
      },
      deleteChild: async (id: string) => {
        await deleteChildAction(id)
        await mutate((current) => (current ?? []).filter((child) => child.id !== id), {
          revalidate: true,
        })
      },
    }
  }, [data, mutate, isReady, userId])

  return <ChildrenContext.Provider value={value}>{node}</ChildrenContext.Provider>
}

export function useChildrenStore() {
  const value = useContext(ChildrenContext)
  if (!value) throw new Error("useChildrenStore must be used inside ChildrenStoreProvider")
  return value
}
