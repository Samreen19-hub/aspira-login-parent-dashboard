import { MessagesView } from "@/components/parent/messages-view"

// The Network "Message" button navigates here as /parent/messages?to=<userId>.
// We read that on the server (Next 16 searchParams is async) and hand it to the
// view as the initially opened direct conversation. Reuses the existing
// direct-conversation selection — no new messaging system or data layer.
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[] }>
}) {
  const { to } = await searchParams
  const initialUserId = Array.isArray(to) ? to[0] : to
  return <MessagesView initialUserId={initialUserId} />
}
