"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import useSWR from "swr"
import { SOCIAL_SPACES, type SocialSpace } from "@/lib/parent-data"
import { createSpace, deleteSpace, getMyMemberships, joinSpace, leaveSpace } from "@/app/actions/spaces"

/**
 * Social store for Groups/Communities. Membership, following, and admin state
 * are the DATABASE's job now (via `app/actions/spaces.ts` on
 * `public.space_members`), loaded here through SWR — there is no localStorage
 * membership/following/admin store anymore.
 *
 * The only thing still kept client-side is the list of spaces the user has
 * CREATED. Space definitions (title/category/privacy/slug) have no server
 * persistence yet — and inventing one is out of scope — so a created space's
 * definition lives in localStorage while its membership (creator = admin) is
 * written to the database like every other membership.
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
// Only created-space DEFINITIONS are stored locally; membership lives in the DB.
const CREATED_KEY = "aspira-parent-created-spaces"

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  const [createdSpaces, setCreatedSpaces] = useState<SocialSpace[]>([])
  const [createdHydrated, setCreatedHydrated] = useState(false)
  useEffect(() => {
    try {
      const value = localStorage.getItem(CREATED_KEY)
      if (value) setCreatedSpaces(JSON.parse(value))
    } catch {} finally { setCreatedHydrated(true) }
  }, [])
  useEffect(() => { if (!createdHydrated) return; localStorage.setItem(CREATED_KEY, JSON.stringify(createdSpaces)) }, [createdHydrated, createdSpaces])

  // The signed-in user's live memberships (slug + role) from the database.
  const { data: memberships, mutate } = useSWR("space-memberships", getMyMemberships, { revalidateOnFocus: false })

  const value = useMemo<SocialState>(() => {
    const spaces = [...createdSpaces, ...SOCIAL_SPACES]
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
      hydrated: createdHydrated && memberships !== undefined,
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
      // Create: persist the definition locally and record the creator as ADMIN
      // in the database (auto-join + auto-admin), then revalidate memberships.
      addSpace: async (space: SocialSpace) => {
        setCreatedSpaces((items) => (items.some((item) => item.slug === space.slug) ? items : [space, ...items]))
        try { await createSpace(space.slug) } catch {}
        await mutate()
      },
      // Admin-only delete: remove every membership row for the space (enforced
      // server-side) and drop the local definition if it was a created space.
      removeSpace: async (slug: string) => {
        try { await deleteSpace(slug) } catch {}
        setCreatedSpaces((items) => items.filter((item) => item.slug !== slug))
        await mutate()
      },
      getSpace: (slug: string) => spaces.find((space) => space.slug === slug),
      refresh: () => mutate(),
    }
  }, [createdSpaces, createdHydrated, memberships, mutate])

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
