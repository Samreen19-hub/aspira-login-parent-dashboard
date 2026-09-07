"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import {
  acceptConnectionRequest,
  declineConnectionRequest,
  followUser,
  getConnections,
  getDiscoverPeople,
  getFollowers,
  getFollowing,
  getIncomingRequests,
  removeConnection as removeConnectionAction,
  sendConnectionRequest,
  unfollowUser,
  type SendRequestResult,
} from "@/app/actions/network"
import { type NetworkPerson } from "@/lib/network-data"

// Single source of truth for the parent's people-relationships. Connections, incoming requests,
// Discover, Following and Followers are all backed by real Neon tables (`public.connections` and
// `public.follows`) through server actions, fetched and cached with SWR. Mutations call those
// actions and then revalidate so the database stays the source of truth and refreshing never loses
// state. Counts are derived from the real lists — nothing here is hardcoded.
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
  // Follows a real user (one-way, immediate) and refreshes Discover/Following/Followers.
  follow: (userId: string) => Promise<void>
  // Unfollows a real user and refreshes Discover/Following/Followers.
  unfollow: (userId: string) => Promise<void>
}

const NetworkContext = createContext<NetworkState | null>(null)

const DISCOVER_KEY = "parent-network:discover"
const CONNECTIONS_KEY = "parent-network:connections"
const REQUESTS_KEY = "parent-network:requests"
const FOLLOWING_KEY = "parent-network:following"
const FOLLOWERS_KEY = "parent-network:followers"

export function NetworkStoreProvider({ children }: { children: ReactNode }) {
  const discover = useSWR(DISCOVER_KEY, getDiscoverPeople)
  const connections = useSWR(CONNECTIONS_KEY, getConnections)
  const requests = useSWR(REQUESTS_KEY, getIncomingRequests)
  const following = useSWR(FOLLOWING_KEY, getFollowing)
  const followers = useSWR(FOLLOWERS_KEY, getFollowers)

  const value = useMemo<NetworkState>(() => {
    const connectionList = connections.data ?? []
    const requestList = requests.data ?? []
    const discoverList = discover.data ?? []
    const followingList = following.data ?? []
    const followerList = followers.data ?? []

    async function refreshAll() {
      await Promise.all([discover.mutate(), connections.mutate(), requests.mutate()])
    }

    // Discover shows the Follow/Following state, so every follow mutation must also refresh it
    // alongside the Following and Followers lists.
    async function refreshFollows() {
      await Promise.all([discover.mutate(), following.mutate(), followers.mutate()])
    }

    return {
      connections: connectionList,
      requests: requestList,
      discover: discoverList,
      following: followingList,
      followers: followerList,
      connectionCount: connectionList.length,
      followingCount: followingList.length,
      followerCount: followerList.length,
      requestCount: requestList.length,
      isLoading:
        (!discover.data && !discover.error) ||
        (!connections.data && !connections.error) ||
        (!requests.data && !requests.error) ||
        (!following.data && !following.error) ||
        (!followers.data && !followers.error),
      error: Boolean(
        discover.error ||
          connections.error ||
          requests.error ||
          following.error ||
          followers.error,
      ),
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
      follow: async (userId: string) => {
        await followUser(userId)
        await refreshFollows()
      },
      unfollow: async (userId: string) => {
        await unfollowUser(userId)
        await refreshFollows()
      },
    }
  }, [discover, connections, requests, following, followers])

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
}

export function useNetworkStore() {
  const value = useContext(NetworkContext)
  if (!value) throw new Error("useNetworkStore must be used inside NetworkStoreProvider")
  return value
}
