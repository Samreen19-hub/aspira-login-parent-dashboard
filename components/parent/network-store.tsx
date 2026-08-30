"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  CONNECTIONS,
  CONNECTION_REQUESTS,
  FOLLOWING,
  FOLLOWERS,
  NETWORK_STATS,
  type NetworkPerson,
} from "@/lib/network-data"

// Single source of truth for the parent's people-relationships (connections, pending requests,
// following, followers). The existing social-store handles group/community spaces only, so this is
// the one relationship store for people — no duplicate stores. State is tracked as id lists layered
// over the sample data so it stays small, serializable, and easy to remap when the Parent, Student,
// School, Company and University dashboards merge onto a shared relationship model.
type NetworkState = {
  connections: NetworkPerson[]
  requests: NetworkPerson[]
  following: NetworkPerson[]
  followers: NetworkPerson[]
  connectionCount: number
  followingCount: number
  followerCount: number
  requestCount: number
  hydrated: boolean
  // Moves a pending request into Connections and bumps the connection count.
  acceptRequest: (id: string) => void
  // Drops a pending request without adding a connection.
  declineRequest: (id: string) => void
  // Removes a person from Connections and decrements the connection count.
  removeConnection: (id: string) => void
}

const NetworkContext = createContext<NetworkState | null>(null)

const REMOVED_KEY = "aspira-parent-removed-connections"
const ACCEPTED_KEY = "aspira-parent-accepted-requests"
const DECLINED_KEY = "aspira-parent-declined-requests"

export function NetworkStoreProvider({ children }: { children: ReactNode }) {
  const [removedConnections, setRemovedConnections] = useState<string[]>([])
  const [acceptedRequests, setAcceptedRequests] = useState<string[]>([])
  const [declinedRequests, setDeclinedRequests] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const removed = localStorage.getItem(REMOVED_KEY)
      const accepted = localStorage.getItem(ACCEPTED_KEY)
      const declined = localStorage.getItem(DECLINED_KEY)
      if (removed) setRemovedConnections(JSON.parse(removed))
      if (accepted) setAcceptedRequests(JSON.parse(accepted))
      if (declined) setDeclinedRequests(JSON.parse(declined))
    } catch {
    } finally {
      setHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(REMOVED_KEY, JSON.stringify(removedConnections))
  }, [hydrated, removedConnections])
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(ACCEPTED_KEY, JSON.stringify(acceptedRequests))
  }, [hydrated, acceptedRequests])
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(DECLINED_KEY, JSON.stringify(declinedRequests))
  }, [hydrated, declinedRequests])

  const value = useMemo<NetworkState>(() => {
    // Accepted requests are prepended to Connections so a freshly accepted person shows up first.
    const acceptedPeople = CONNECTION_REQUESTS.filter((p) => acceptedRequests.includes(p.id))
    const connections = [...acceptedPeople, ...CONNECTIONS].filter(
      (p) => !removedConnections.includes(p.id),
    )
    const requests = CONNECTION_REQUESTS.filter(
      (p) => !acceptedRequests.includes(p.id) && !declinedRequests.includes(p.id),
    )
    const following = FOLLOWING
    const followers = FOLLOWERS

    // Counts stay anchored to the seeded totals (128/85/64) and only move by the relative delta of
    // the current session's accepts/removes, so the header and stat cards stay in sync. Accepting a
    // request is +1 and removing a connection is -1; a person accepted then removed nets to zero.
    const connectionCount =
      NETWORK_STATS.connections + acceptedPeople.length - removedConnections.length

    return {
      connections,
      requests,
      following,
      followers,
      connectionCount,
      followingCount: NETWORK_STATS.following,
      followerCount: NETWORK_STATS.followers,
      requestCount: requests.length,
      hydrated,
      acceptRequest: (id: string) =>
        setAcceptedRequests((ids) => (ids.includes(id) ? ids : [...ids, id])),
      declineRequest: (id: string) =>
        setDeclinedRequests((ids) => (ids.includes(id) ? ids : [...ids, id])),
      removeConnection: (id: string) =>
        setRemovedConnections((ids) => (ids.includes(id) ? ids : [...ids, id])),
    }
  }, [removedConnections, acceptedRequests, declinedRequests, hydrated])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetworkStore() {
  const value = useContext(NetworkContext)
  if (!value) throw new Error("useNetworkStore must be used inside NetworkStoreProvider")
  return value
}
