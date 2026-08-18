"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { SOCIAL_SPACES, type SocialSpace } from "@/lib/parent-data"

type SocialState = {
  joined: string[]
  following: string[]
  createdSpaces: SocialSpace[]
  spaces: SocialSpace[]
  toggleJoined: (slug: string) => void
  toggleFollowing: (slug: string) => void
  addSpace: (space: SocialSpace) => void
  getSpace: (slug: string) => SocialSpace | undefined
}
const SocialContext = createContext<SocialState | null>(null)

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  const [joined, setJoined] = useState<string[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const [createdSpaces, setCreatedSpaces] = useState<SocialSpace[]>([])
  const value = useMemo<SocialState>(() => {
    const spaces = [...createdSpaces, ...SOCIAL_SPACES]
    return {
      joined,
      following,
      createdSpaces,
      spaces,
      toggleJoined: (slug: string) => setJoined((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      toggleFollowing: (slug: string) => setFollowing((items) => (items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug])),
      addSpace: (space: SocialSpace) => {
        setCreatedSpaces((items) => (items.some((item) => item.slug === space.slug) ? items : [space, ...items]))
        setJoined((items) => (items.includes(space.slug) ? items : [...items, space.slug]))
      },
      getSpace: (slug: string) => spaces.find((space) => space.slug === slug),
    }
  }, [joined, following, createdSpaces])
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
