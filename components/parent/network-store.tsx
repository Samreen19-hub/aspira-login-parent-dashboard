"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import {
  acceptConnectionRequest,
  declineConnectionRequest,
  getConnections,
  getDiscoverPeople,
  getIncomingRequests,
  removeConnection as removeConnectionAction,
  sendConnectionRequest,
  type SendRequestResult,
} from "@/app/actions/network"
import { FOLLOWING, FOLLOWERS, NETWORK_STATS, type NetworkPerson } from "@/lib/network-data"

// Single source of truth for the parent's people-relationships. Connections, incoming requests and
// Discover are backed by the real Neon `public.connections` table through server actions (fetched
// and cached with SWR); mutations call those actions and then revalidate so the database stays the
// source of truth and refreshing never loses state. Following/Followers remain demo-only data —
// there is no follow schema yet — so this store keeps their existing behavior untouched.
type NetworkState = {
  connections: NetworkPerson[]
  requests: NetworkPerson[]
  discover: NetworkPerson[]
  following: NetworkPerson[]
  followers: NetworkPerson[]
  connectionCount: number
  followingCount: number
  followerCount: number
  requestCount: number
  // True during the initial load of the database-backed lists.
  isLoading: boolean
  // True when any of the database-backed lists failed to load.
  error: boolean
  // Sends a connection request to a real user and refreshes Discover + Connections.
  sendRequest: (userId: string) => Promise<SendRequestResult>
  // Accepts an incoming request (by connections row id) and refreshes all lists.
  acceptRequest: (connectionId: string) => Promise<void>
  // Declines an incoming request (by connections row id) and refreshes requests.
  declineRequest: (connectionId: string) => Promise<void>
  // Removes an accepted connection (by the other person's user id) and refreshes.
  removeConnection: (userId: string) => Promise<void>
}

const NetworkContext = createContext<NetworkState | null>(null)

const DISCOVER_KEY = "parent-network:discover"
const CONNECTIONS_KEY = "parent-network:connections"
const REQUESTS_KEY = "parent-network:requests"

export function NetworkStoreProvider({ children }: { children: ReactNode }) {
  const discover = useSWR(DISCOVER_KEY, getDiscoverPeople)
  const connections = useSWR(CONNECTIONS_KEY, getConnections)
  const requests = useSWR(REQUESTS_KEY, getIncomingRequests)

  const value = useMemo<NetworkState>(() => {
    const connectionList = connections.data ?? []
    const requestList = requests.data ?? []
    const discoverList = discover.data ?? []

    async function refreshAll() {
      await Promise.all([discover.mutate(), connections.mutate(), requests.mutate()])
    }

    return {
      connections: connectionList,
      requests: requestList,
      discover: discoverList,
      following: FOLLOWING,
      followers: FOLLOWERS,
      connectionCount: connectionList.length,
      // Following/Followers are demo-only (no schema); keep the seeded totals.
      followingCount: NETWORK_STATS.following,
      followerCount: NETWORK_STATS.followers,
      requestCount: requestList.length,
      isLoading:
        (!discover.data && !discover.error) ||
        (!connections.data && !connections.error) ||
        (!requests.data && !requests.error),
      error: Boolean(discover.error || connections.error || requests.error),
      sendRequest: async (userId: string) => {
        const result = await sendConnectionRequest(userId)
        await Promise.all([discover.mutate(), connections.mutate()])
        return result
      },
      acceptRequest: async (connectionId: string) => {
        await acceptConnectionRequest(connectionId)
        await refreshAll()
      },
      declineRequest: async (connectionId: string) => {
        await declineConnectionRequest(connectionId)
        await Promise.all([requests.mutate(), discover.mutate()])
      },
      removeConnection: async (userId: string) => {
        await removeConnectionAction(userId)
        await Promise.all([connections.mutate(), discover.mutate()])
      },
    }
  }, [discover, connections, requests])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetworkStore() {
  const value = useContext(NetworkContext)
  if (!value) throw new Error("useNetworkStore must be used inside NetworkStoreProvider")
  return value
}
