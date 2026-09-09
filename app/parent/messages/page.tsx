import { MessagesView } from "@/components/parent/messages-view"

// The Network "Message" button navigates here as /parent/messages?to=<userId>,
// and a group_message notification deep-links as /parent/messages?group=<conversationId>.
// We read those on the server (Next 16 searchParams is async) and hand them to
// the view as the initially opened conversation. Both reuse the existing
// conversation-selection keys — no new messaging system or data layer.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; group?: string | string[] }>
}) {
  const { to, group } = await searchParams
  const initialUserId = Array.isArray(to) ? to[0] : to
  const initialGroupId = Array.isArray(group) ? group[0] : group
  return <MessagesView initialUserId={initialUserId} initialGroupId={initialGroupId} />
}
