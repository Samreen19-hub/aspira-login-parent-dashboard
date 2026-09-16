"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import { useSession } from "@/lib/auth-client"
import type { SocialSpace } from "@/lib/parent-data"
import {
  createSpace,
  deleteSpace,
  getMyMemberships,
  joinSpace,
  leaveSpace,
  listSpaces,
} from "@/app/actions/spaces"

/**
 * Social store for Groups/Communities. Everything is the DATABASE's job now:
 *   - Space DEFINITIONS (existence + metadata) come from `public.spaces` via
 *     `listSpaces` (server action), NOT from a hardcoded array or localStorage.
 *   - Membership / following / admin state come from `public.space_members` via
 *     `getMyMemberships`.
 * Both are loaded through SWR so a created space survives refresh, logout/login,
 * and appears on other devices/sessions. There is NO localStorage source of
 * truth for whether a space exists anymore.
 */
type SocialState = {
  spaces: SocialSpace[]
  /** Slugs the signed-in user belongs to (group membership + community following). */
  joined: string[]
  following: string[]
  hydrated: boolean
  /** True when the signed-in user is an admin of the space (role = 'admin'). */
  isAdmin: (slug: string) => boolean
  /** Join/leave a group. Resolves to an error message when a join was rejected (e.g. join policy), else null. */
  toggleJoined: (slug: string) => Promise<string | null>
  /** Follow/unfollow a community. Communities are unrestricted, so this resolves to null. */
  toggleFollowing: (slug: string) => Promise<string | null>
  /** Creates a space server-side and returns its final (guaranteed-unique) slug, or null if it failed. */
  addSpace: (space: SocialSpace) => Promise<string | null>
  removeSpace: (slug: string) => Promise<void>
  getSpace: (slug: string) => SocialSpace | undefined
  /** Revalidate the signed-in user's memberships (call after a roster mutation). */
  refresh: () => Promise<unknown>
}
const SocialContext = createContext<SocialState | null>(null)

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  // Every listing/membership query is SCOPED to the signed-in user's id so a
  // different user's cached spaces are never reused after login/logout. Until
  // the session resolves (userId null) the keys are null, so nothing is fetched
  // and no previous user's data can be shown.
  const { data: session } = useSession()
  const userId = session?.user?.id ?? null
  // The full set of spaces that EXIST, from the database (public.spaces).
  const { data: dbSpaces, mutate: mutateSpaces } = useSWR(userId ? ["spaces", userId] : null, () => listSpaces(), { revalidateOnFocus: false })
  // The signed-in user's live memberships (slug + role) from the database.
  const { data: memberships, mutate } = useSWR(userId ? ["space-memberships", userId] : null, () => getMyMemberships(), { revalidateOnFocus: false })

  const value = useMemo<SocialState>(() => {
    const spaces = dbSpaces ?? []
    const rows = memberships ?? []
    const memberSlugs = rows.map((row) => row.slug)
    const adminSlugs = new Set(rows.filter((row) => row.role === "admin").map((row) => row.slug))
    const isMemberOf = (slug: string) => rows.some((row) => row.slug === slug)
    return {
      spaces,
      // A slug is only ever one kind, so the same member-slug set serves both
      // group "joined" and community "following" checks in the UI.
      joined: memberSlugs,
      following: memberSlugs,
      hydrated: dbSpaces !== undefined && memberships !== undefined,
      isAdmin: (slug: string) => adminSlugs.has(slug),
      // Join/leave a group. Group join is policy-gated server-side (anyone /
      // connections / invite), so a rejected join surfaces its message to the
      // caller instead of being swallowed. A sole-admin leave is also rejected
      // server-side (they must transfer or delete via the detail page). Either
      // way we revalidate, and return the message (or null on success).
      toggleJoined: async (slug: string) => {
        let error: string | null = null
        try {
          if (isMemberOf(slug)) await leaveSpace(slug)
          else await joinSpace(slug)
        } catch (cause) {
          error = cause instanceof Error ? cause.message : "Something went wrong. Please try again."
        }
        await mutate()
        return error
      },
      // Follow/unfollow a community — same table, but communities are always
      // public and unrestricted, so a follow never fails a policy check.
      toggleFollowing: async (slug: string) => {
        let error: string | null = null
        try {
          if (isMemberOf(slug)) await leaveSpace(slug)
          else await joinSpace(slug)
        } catch (cause) {
          error = cause instanceof Error ? cause.message : "Something went wrong. Please try again."
        }
        await mutate()
        return error
      },
      // Create: persist the space DEFINITION to public.spaces AND record the
      // creator as ADMIN in public.space_members (both server-side, creator id
      // taken from the session), then revalidate spaces + memberships so the new
      // space is immediately resolvable (e.g. by the detail page we navigate to).
      addSpace: async (space: SocialSpace) => {
        // createSpace assigns the FINAL, guaranteed-unique slug server-side (it
        // may differ from the requested one on collision) and returns it, so the
        // caller can navigate to / invite against the slug that was actually
        // created rather than the optimistic client guess.
        let created: string | null = null
        try {
          created = await createSpace({
            slug: space.slug,
            kind: space.kind,
            title: space.title,
            description: space.description,
            category: space.category,
            // Privacy is intentionally not sent: communities are always public
            // and groups are governed by joinPolicy, so createSpace stores a
            // fixed 'Public' server-side. Access is kind-based, not privacy-based.
            joinPolicy: space.joinPolicy,
          })
        } catch {}
        await Promise.all([mutateSpaces(), mutate()])
        return created
      },
      // Admin-only delete: remove the space definition + every membership row
      // (enforced server-side), then revalidate both lists.
      removeSpace: async (slug: string) => {
        try { await deleteSpace(slug) } catch {}
        await Promise.all([mutateSpaces(), mutate()])
      },
      getSpace: (slug: string) => spaces.find((space) => space.slug === slug),
      refresh: () => mutate(),
    }
  }, [dbSpaces, memberships, mutate, mutateSpaces])

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
