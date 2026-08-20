"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { SOCIAL_SPACES, CURRENT_PARENT, type SocialSpace } from "@/lib/parent-data"

type SocialState = {
  joined: string[]
  following: string[]
  createdSpaces: SocialSpace[]
  // Per-space admins tracked by member name. The current parent is `CURRENT_PARENT`. This lets a
  // space have multiple admins and lets ownership be transferred to another member/follower.
  spaceAdmins: Record<string, string[]>
  spaces: SocialSpace[]
  hydrated: boolean
  toggleJoined: (slug: string) => void
  toggleFollowing: (slug: string) => void
  addSpace: (space: SocialSpace) => void
  removeSpace: (slug: string) => void
  isAdmin: (slug: string) => boolean
  getAdmins: (slug: string) => string[]
  // Current parent leaves a space. When they are the sole admin, `transferTo` names the
  // member/follower who becomes the new admin so the space is never left ownerless.
  leaveSpace: (slug: string, transferTo?: string) => void
  getSpace: (slug: string) => SocialSpace | undefined
}
const SocialContext = createContext<SocialState | null>(null)
const JOINED_KEY = "aspira-parent-joined-spaces"
const FOLLOWING_KEY = "aspira-parent-following-spaces"
const CREATED_KEY = "aspira-parent-created-spaces"
const ADMIN_KEY = "aspira-parent-space-admins"
const LEGACY_ADMIN_KEY = "aspira-parent-admin-spaces"

// Seed the current parent into some spaces (and not others) so both joined/unjoined and
// following/unfollowed states are demonstrable on a fresh device. Overridden by localStorage once set.
const DEFAULT_JOINED = ["class-6-parents", "robotics-parents"]
const DEFAULT_FOLLOWING = ["greenfield-public-school", "young-scientists"]

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  const [joined, setJoined] = useState<string[]>(DEFAULT_JOINED)
  const [following, setFollowing] = useState<string[]>(DEFAULT_FOLLOWING)
  const [createdSpaces, setCreatedSpaces] = useState<SocialSpace[]>([])
  // Admins per space, keyed by slug and stored as member names. Only spaces the parent created
  // seed the current parent as admin, so the seeded spaces never grant admin/delete powers.
  const [spaceAdmins, setSpaceAdmins] = useState<Record<string, string[]>>({})
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const joinedValue = localStorage.getItem(JOINED_KEY)
      const followingValue = localStorage.getItem(FOLLOWING_KEY)
      const createdValue = localStorage.getItem(CREATED_KEY)
      const adminValue = localStorage.getItem(ADMIN_KEY)
      if (joinedValue) setJoined(JSON.parse(joinedValue))
      if (followingValue) setFollowing(JSON.parse(followingValue))
      if (createdValue) setCreatedSpaces(JSON.parse(createdValue))
      if (adminValue) {
        setSpaceAdmins(JSON.parse(adminValue))
      } else {
        // Migrate the previous slug-list admin model: each slug becomes a space the current
        // parent solely admins, preserving admin rights across the store upgrade.
        const legacy = localStorage.getItem(LEGACY_ADMIN_KEY)
        if (legacy) {
          const slugs: string[] = JSON.parse(legacy)
          setSpaceAdmins(Object.fromEntries(slugs.map((slug) => [slug, [CURRENT_PARENT]])))
        }
      }
    } catch {} finally { setHydrated(true) }
  }, [])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(JOINED_KEY, JSON.stringify(joined)) }, [hydrated, joined])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following)) }, [hydrated, following])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(CREATED_KEY, JSON.stringify(createdSpaces)) }, [hydrated, createdSpaces])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(ADMIN_KEY, JSON.stringify(spaceAdmins)) }, [hydrated, spaceAdmins])
  const value = useMemo<SocialState>(() => {
    const spaces = [...createdSpaces, ...SOCIAL_SPACES]
    return {
      joined,
      following,
      createdSpaces,
      spaceAdmins,
      spaces,
      hydrated,
      toggleJoined: (slug: string) => setJoined((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      toggleFollowing: (slug: string) => setFollowing((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      addSpace: (space: SocialSpace) => {
        setCreatedSpaces((items) => (items.some((item) => item.slug === space.slug) ? items : [space, ...items]))
        // The creator automatically becomes owner/admin of their new space and immediately gets
        // the membership relationship: a Group creator becomes a member (joined), a Community
        // creator becomes a follower (following). Persisted so access control recognizes the
        // creator as admin+member/follower right away, regardless of Public/Private.
        setSpaceAdmins((current) => ({ ...current, [space.slug]: [CURRENT_PARENT] }))
        if (space.kind === "groups") {
          setJoined((items) => (items.includes(space.slug) ? items : [...items, space.slug]))
        } else {
          setFollowing((items) => (items.includes(space.slug) ? items : [...items, space.slug]))
        }
      },
      // Admin-only deletion. Removes the created space and clears every trace of the current
      // parent's relationship to it (membership, following, admins) so it disappears from the
      // listings and from My groups / Following. Scoped posts are removed via the feed store.
      removeSpace: (slug: string) => {
        setCreatedSpaces((items) => items.filter((item) => item.slug !== slug))
        setSpaceAdmins((current) => { const next = { ...current }; delete next[slug]; return next })
        setJoined((items) => items.filter((item) => item !== slug))
        setFollowing((items) => items.filter((item) => item !== slug))
      },
      // Leave/unfollow. Drops the current parent from the admin list (if present) and from
      // membership/following. When `transferTo` is provided (sole-admin case), that member/follower
      // is promoted to admin first so the space always retains at least one admin.
      leaveSpace: (slug: string, transferTo?: string) => {
        setSpaceAdmins((current) => {
          const existing = current[slug] ?? []
          let next = existing.filter((name) => name !== CURRENT_PARENT)
          if (transferTo && !next.includes(transferTo)) next = [transferTo, ...next]
          return { ...current, [slug]: next }
        })
        setJoined((items) => items.filter((item) => item !== slug))
        setFollowing((items) => items.filter((item) => item !== slug))
      },
      isAdmin: (slug: string) => (spaceAdmins[slug] ?? []).includes(CURRENT_PARENT),
      getAdmins: (slug: string) => spaceAdmins[slug] ?? [],
      getSpace: (slug: string) => spaces.find((space) => space.slug === slug),
    }
  }, [joined, following, createdSpaces, spaceAdmins, hydrated])
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
