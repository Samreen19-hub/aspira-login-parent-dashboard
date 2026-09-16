"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
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
  toggleJoined: (slug: string) => Promise<void>
  toggleFollowing: (slug: string) => Promise<void>
  addSpace: (space: SocialSpace) => Promise<void>
  removeSpace: (slug: string) => Promise<void>
  getSpace: (slug: string) => SocialSpace | undefined
  /** Revalidate the signed-in user's memberships (call after a roster mutation). */
  refresh: () => Promise<unknown>
}
const SocialContext = createContext<SocialState | null>(null)

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  // The full set of spaces that EXIST, from the database (public.spaces).
  const { data: dbSpaces, mutate: mutateSpaces } = useSWR("spaces", listSpaces, { revalidateOnFocus: false })
  // The signed-in user's live memberships (slug + role) from the database.
  const { data: memberships, mutate } = useSWR("space-memberships", getMyMemberships, { revalidateOnFocus: false })

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
      // Join/leave a group. A sole-admin leave is rejected server-side (they must
      // transfer or delete via the detail page), so we just revalidate on failure.
      toggleJoined: async (slug: string) => {
        try { if (isMemberOf(slug)) await leaveSpace(slug); else await joinSpace(slug) } catch {}
        await mutate()
      },
      // Follow/unfollow a community — same table, same semantics as above.
      toggleFollowing: async (slug: string) => {
        try { if (isMemberOf(slug)) await leaveSpace(slug); else await joinSpace(slug) } catch {}
        await mutate()
      },
      // Create: persist the space DEFINITION to public.spaces AND record the
      // creator as ADMIN in public.space_members (both server-side, creator id
      // taken from the session), then revalidate spaces + memberships so the new
      // space is immediately resolvable (e.g. by the detail page we navigate to).
      addSpace: async (space: SocialSpace) => {
        try {
          await createSpace({
            slug: space.slug,
            kind: space.kind,
            title: space.title,
            description: space.description,
            category: space.category,
            privacy: space.privacy,
            joinPolicy: space.joinPolicy,
          })
        } catch {}
        await Promise.all([mutateSpaces(), mutate()])
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
