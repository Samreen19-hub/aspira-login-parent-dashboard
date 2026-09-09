"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import {
  getNotifications,
  markAllRead as markAllReadAction,
  markRead as markReadAction,
  type NotificationView,
} from "@/app/actions/notifications"

// Source of truth for the parent's notifications, backed by the real Neon database through the
// notification server actions. It mirrors the existing `messages-store` architecture exactly:
// near-real-time delivery is achieved by polling with SWR (`refreshInterval`) plus
// revalidate-on-focus — Neon Postgres has no browser-facing push channel, so short-interval polling
// is the pragmatic realtime mechanism using only the existing database. The unread badge count is
// derived from the same fetched list so the header bell and the list can never disagree. The current
// user is resolved server-side from the Better Auth session inside the actions — the client never
// asserts its own identity.
const POLL_INTERVAL_MS = 4000

const NOTIFICATIONS_KEY = "parent-notifications:list"

type NotificationsState = {
  notifications: NotificationView[]
  unreadCount: number
  isLoading: boolean
  error: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refresh: () => Promise<unknown>
}

const NotificationsContext = createContext<NotificationsState | null>(null)

export function NotificationsStoreProvider({ children }: { children: ReactNode }) {
  const swr = useSWR(NOTIFICATIONS_KEY, getNotifications, {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
  })

  const value = useMemo<NotificationsState>(() => {
    const list = swr.data ?? []
    return {
      notifications: list,
      unreadCount: list.reduce((total, item) => total + (item.read ? 0 : 1), 0),
      isLoading: !swr.data && !swr.error,
      error: Boolean(swr.error),
      markRead: async (id: string) => {
        await markReadAction(id)
        await swr.mutate()
      },
      markAllRead: async () => {
        await markAllReadAction()
        await swr.mutate()
      },
      refresh: () => swr.mutate(),
    }
  }, [swr])

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsStore() {
  const value = useContext(NotificationsContext)
  if (!value) throw new Error("useNotificationsStore must be used inside NotificationsStoreProvider")
  return value
}
