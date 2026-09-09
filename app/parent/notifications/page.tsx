"use client"

import { useRouter } from "next/navigation"
import { Bell, Loader2, MessageSquare, UserCheck, UserPlus, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageShell } from "@/components/parent/page-shell"
import {
  useNotificationsStore,
} from "@/components/parent/notifications-store"
import {
  resolveGroupConversationId,
  type NotificationView,
} from "@/app/actions/notifications"

// Presentation mapping only — it turns a stored notification (type + actor + body) into display
// text/icon/route WITHOUT changing the database model. School Updates remain a separate feature and
// are intentionally not merged here.
type Presentation = {
  icon: typeof Bell
  title: string
  description: string | null
  href: string
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "Just now"
  if (min < 60) return `${min}m ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

function present(notification: NotificationView): Presentation {
  const actor = notification.actorName ?? "Someone"
  switch (notification.type) {
    case "message":
      return {
        icon: MessageSquare,
        title: `New message from ${actor}`,
        description: notification.body,
        // The actor is the other participant of the 1-to-1 conversation, so we
        // reuse the existing /parent/messages?to=<userId> deep-link that the
        // Network "Message" button already uses to open the direct thread.
        href: notification.actorId
          ? `/parent/messages?to=${notification.actorId}`
          : "/parent/messages",
      }
    case "group_message":
      return {
        icon: Users,
        title: `${actor} posted in a group`,
        description: notification.body,
        // entity_id is the message id, not the conversation. The conversation
        // is resolved server-side at click time (see handleOpen) and appended
        // as ?group=<conversationId>; this base href is the fallback.
        href: "/parent/messages",
      }
    case "connection_request":
      return {
        icon: UserPlus,
        title: `${actor} sent you a connection request`,
        description: null,
        href: "/parent/network/requests",
      }
    case "connection_accepted":
      return {
        icon: UserCheck,
        title: `${actor} accepted your connection request`,
        description: null,
        href: "/parent/network",
      }
    case "follow":
      return {
        icon: UserPlus,
        title: `${actor} started following you`,
        description: null,
        // Open the Followers tab (the actor is a new follower), reusing the
        // existing Network tab selection via ?tab=followers.
        href: "/parent/network?tab=followers",
      }
    default:
      return {
        icon: Bell,
        title: notification.body ?? "New notification",
        description: null,
        href: "/parent/notifications",
      }
  }
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, unreadCount, isLoading, error, markRead, markAllRead } =
    useNotificationsStore()

  async function handleOpen(notification: NotificationView, href: string) {
    if (!notification.read) await markRead(notification.id)

    // A group_message notification's entity_id is the message id, so resolve
    // the owning group conversation server-side and deep-link to it. On any
    // failure we fall back to the base /parent/messages href.
    let destination = href
    if (notification.type === "group_message" && notification.entityId) {
      try {
        const conversationId = await resolveGroupConversationId(notification.entityId)
        if (conversationId) destination = `/parent/messages?group=${conversationId}`
      } catch {
        // keep the fallback href
      }
    }

    router.push(destination)
  }

  return (
    <PageShell
      title="Notifications"
      description="Activity from your Aspira network — messages, connections, and follows."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "You're all caught up"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={unreadCount === 0}
          onClick={() => markAllRead()}
        >
          Mark all as read
        </Button>
      </div>

      {isLoading ? (
        <Card className="items-center gap-3 p-12 text-center">
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-sm text-muted-foreground">Loading your notifications…</p>
        </Card>
      ) : error ? (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <Bell className="size-7" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Couldn&apos;t load notifications
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Something went wrong fetching your notifications. They will refresh automatically.
          </p>
        </Card>
      ) : notifications.length === 0 ? (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <Bell className="size-7" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">No notifications yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            When someone messages you, sends a connection request, or follows you, it will show up
            here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {notifications.map((notification) => {
            const view = present(notification)
            const Icon = view.icon
            return (
              <Card
                key={notification.id}
                className={cardClass(notification.read)}
                onClick={() => handleOpen(notification, view.href)}
              >
                <div className="flex items-start gap-3">
                  {notification.actorAvatar ? (
                    <Avatar size="default" className="shrink-0">
                      <AvatarImage src={notification.actorAvatar} alt="" />
                      <AvatarFallback>{(notification.actorName ?? "A")[0]}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
                      <Icon className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-semibold text-foreground">{view.title}</h2>
                      {!notification.read && <Badge>Unread</Badge>}
                    </div>
                    {view.description && (
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {view.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-muted"
                      onClick={(event) => {
                        event.stopPropagation()
                        markRead(notification.id)
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

function cardClass(read: boolean): string {
  return read
    ? "cursor-pointer gap-3 p-5 transition-colors hover:bg-muted/50"
    : "cursor-pointer gap-3 border-brand/30 bg-brand-muted/30 p-5 transition-colors hover:bg-brand-muted/50"
}
