"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { SOCIAL_SPACES, type SocialSpace } from "@/lib/parent-data"

type SocialState = {
  joined: string[]
  following: string[]
  createdSpaces: SocialSpace[]
  spaces: SocialSpace[]
  hydrated: boolean
  toggleJoined: (slug: string) => void
  toggleFollowing: (slug: string) => void
  addSpace: (space: SocialSpace) => void
  getSpace: (slug: string) => SocialSpace | undefined
}
const SocialContext = createContext<SocialState | null>(null)
const JOINED_KEY = "aspira-parent-joined-spaces"
const FOLLOWING_KEY = "aspira-parent-following-spaces"
const CREATED_KEY = "aspira-parent-created-spaces"

// Seed the current parent into some spaces (and not others) so both joined/unjoined and
// following/unfollowed states are demonstrable on a fresh device. Overridden by localStorage once set.
const DEFAULT_JOINED = ["class-6-parents", "robotics-parents"]
const DEFAULT_FOLLOWING = ["greenfield-public-school", "young-scientists"]

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  const [joined, setJoined] = useState<string[]>(DEFAULT_JOINED)
  const [following, setFollowing] = useState<string[]>(DEFAULT_FOLLOWING)
  const [createdSpaces, setCreatedSpaces] = useState<SocialSpace[]>([])
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const joinedValue = localStorage.getItem(JOINED_KEY)
      const followingValue = localStorage.getItem(FOLLOWING_KEY)
      const createdValue = localStorage.getItem(CREATED_KEY)
      if (joinedValue) setJoined(JSON.parse(joinedValue))
      if (followingValue) setFollowing(JSON.parse(followingValue))
      if (createdValue) setCreatedSpaces(JSON.parse(createdValue))
    } catch {} finally { setHydrated(true) }
  }, [])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(JOINED_KEY, JSON.stringify(joined)) }, [hydrated, joined])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(FOLLOWING_KEY, JSON.stringify(following)) }, [hydrated, following])
  useEffect(() => { if (!hydrated) return; localStorage.setItem(CREATED_KEY, JSON.stringify(createdSpaces)) }, [hydrated, createdSpaces])
  const value = useMemo<SocialState>(() => {
    const spaces = [...createdSpaces, ...SOCIAL_SPACES]
    return {
      joined,
      following,
      createdSpaces,
      spaces,
      hydrated,
      toggleJoined: (slug: string) => setJoined((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      toggleFollowing: (slug: string) => setFollowing((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      addSpace: (space: SocialSpace) => {
        setCreatedSpaces((items) => (items.some((item) => item.slug === space.slug) ? items : [space, ...items]))
        setJoined((items) => (items.includes(space.slug) ? items : [...items, space.slug]))
      },
      getSpace: (slug: string) => spaces.find((space) => space.slug === slug),
    }
  }, [joined, following, createdSpaces, hydrated])
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
