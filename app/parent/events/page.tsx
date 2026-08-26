import { PageShell } from "@/components/parent/page-shell"
import { EventsView } from "@/components/parent/events-view"

export default function EventsPage() {
  return (
    <PageShell
      title="Events"
      description="School, group and community events — plus the events you create and RSVP to."
    >
      <EventsView />
    </PageShell>
  )
}
