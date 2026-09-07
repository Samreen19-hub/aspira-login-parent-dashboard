"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import { getConversations, type ConversationSummary } from "@/app/actions/messages"

// Source of truth for the parent's inbox, backed by the real Neon `public.messages` table through
// server actions. Near-real-time delivery is achieved by polling with SWR (`refreshInterval`) plus
// revalidate-on-focus — Neon Postgres has no browser-facing push channel, so short-interval polling
// is the pragmatic realtime mechanism using only the existing database, no third-party service.
// The unread badge count is derived from the same conversation data (sum of per-conversation unread)
// so the header badge and the list never disagree.
const POLL_INTERVAL_MS = 4000

type MessagesState = {
  conversations: ConversationSummary[]
  unreadCount: number
  isLoading: boolean
  error: boolean
  refresh: () => Promise<unknown>
}

const MessagesContext = createContext<MessagesState | null>(null)

const CONVERSATIONS_KEY = "parent-messages:conversations"

export function MessagesStoreProvider({ children }: { children: ReactNode }) {
  const conversations = useSWR(CONVERSATIONS_KEY, getConversations, {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
  })

  const value = useMemo<MessagesState>(() => {
    const list = conversations.data ?? []
    return {
      conversations: list,
      unreadCount: list.reduce((total, convo) => total + convo.unreadCount, 0),
      isLoading: !conversations.data && !conversations.error,
      error: Boolean(conversations.error),
      refresh: () => conversations.mutate(),
    }
  }, [conversations])

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessagesStore() {
  const value = useContext(MessagesContext)
  if (!value) throw new Error("useMessagesStore must be used inside MessagesStoreProvider")
  return value
}
