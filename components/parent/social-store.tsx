"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"

type SocialState = { joined: string[]; following: string[]; toggleJoined: (slug: string) => void; toggleFollowing: (slug: string) => void }
const SocialContext = createContext<SocialState | null>(null)

export function SocialStoreProvider({ children }: { children: ReactNode }) {
  const [joined, setJoined] = useState<string[]>([])
  const [following, setFollowing] = useState<string[]>([])
  const value = useMemo(() => ({ joined, following, toggleJoined: (slug: string) => setJoined((items) => items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug]), toggleFollowing: (slug: string) => setFollowing((items) => items.includes(slug) ? items.filter((item) => item !== slug) : [...items, slug]) }), [joined, following])
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>
}

export function useSocialStore() {
  const value = useContext(SocialContext)
  if (!value) throw new Error("useSocialStore must be used inside SocialStoreProvider")
  return value
}
