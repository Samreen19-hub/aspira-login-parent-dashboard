"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import { getConversations, type ConversationSummary } from "@/app/actions/messages"
import { getGroupConversations, type GroupSummary } from "@/app/actions/groups"

// Source of truth for the parent's inbox, backed by the real Neon database through server actions.
// It merges the existing direct conversations (`public.messages` sender/recipient pairs) with group
// conversations (`public.conversations` + `public.conversation_members`) into one list. Near-real-time
// delivery is achieved by polling with SWR (`refreshInterval`) plus revalidate-on-focus — Neon Postgres
// has no browser-facing push channel, so short-interval polling is the pragmatic realtime mechanism
// using only the existing database. The unread badge count is the sum of per-conversation unread across
// BOTH direct and group conversations, so the header badge and the list never disagree.
const POLL_INTERVAL_MS = 4000

// A unified left-column row. `kind` distinguishes the existing direct rows from group rows; `id` is the
// other user's id for direct conversations and the conversation id for groups.
export type InboxItem = {
  kind: "direct" | "group"
  id: string
  name: string
  avatar: string
  headline: string
  lastMessage: string | null
  lastMessageAt: string | null
  lastMessageMine: boolean
  // For group previews: the first name of the last sender (null for direct rows).
  lastMessageSenderName: string | null
  unreadCount: number
  // Member count for group rows (null for direct rows).
  memberCount: number | null
}

type MessagesState = {
  conversations: InboxItem[]
  unreadCount: number
  isLoading: boolean
  error: boolean
  refresh: () => Promise<unknown>
}

const MessagesContext = createContext<MessagesState | null>(null)

const CONVERSATIONS_KEY = "parent-messages:conversations"
const GROUPS_KEY = "parent-messages:groups"

function directToItem(convo: ConversationSummary): InboxItem {
  return {
    kind: "direct",
    id: convo.userId,
    name: convo.name,
    avatar: convo.avatar,
    headline: convo.headline,
    lastMessage: convo.lastMessage,
    lastMessageAt: convo.lastMessageAt,
    lastMessageMine: convo.lastMessageMine,
    lastMessageSenderName: null,
    unreadCount: convo.unreadCount,
    memberCount: null,
  }
}

function groupToItem(group: GroupSummary): InboxItem {
  return {
    kind: "group",
    id: group.conversationId,
    name: group.name,
    avatar: "",
    headline: `${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`,
    lastMessage: group.lastMessage,
    lastMessageAt: group.lastMessageAt,
    lastMessageMine: group.lastMessageMine,
    lastMessageSenderName: group.lastMessageSenderName,
    unreadCount: group.unreadCount,
    memberCount: group.memberCount,
  }
}

export function MessagesStoreProvider({ children }: { children: ReactNode }) {
  const direct = useSWR(CONVERSATIONS_KEY, getConversations, {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
  })
  const groups = useSWR(GROUPS_KEY, getGroupConversations, {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
  })

  const value = useMemo<MessagesState>(() => {
    const directList = (direct.data ?? []).map(directToItem)
    const groupList = (groups.data ?? []).map(groupToItem)

    // Merge and sort by most recent activity; rows without any message yet fall
    // to the bottom ordered by name — matching the existing direct-list rule.
    const merged = [...directList, ...groupList].sort((a, b) => {
      if (a.lastMessageAt && b.lastMessageAt) {
        return b.lastMessageAt.localeCompare(a.lastMessageAt)
      }
      if (a.lastMessageAt) return -1
      if (b.lastMessageAt) return 1
      return a.name.localeCompare(b.name)
    })

    return {
      conversations: merged,
      unreadCount: merged.reduce((total, item) => total + item.unreadCount, 0),
      isLoading: (!direct.data && !direct.error) || (!groups.data && !groups.error),
      error: Boolean(direct.error || groups.error),
      refresh: () => Promise.all([direct.mutate(), groups.mutate()]),
    }
  }, [direct, groups])

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
}

export function useMessagesStore() {
  const value = useContext(MessagesContext)
  if (!value) throw new Error("useMessagesStore must be used inside MessagesStoreProvider")
  return value
}
