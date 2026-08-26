import { PageShell } from "@/components/parent/page-shell"
import { SchoolUpdatesView } from "@/components/parent/school-updates-view"

export default function SchoolUpdatesPage() {
  return (
    <PageShell
      title="School Updates"
      description="Important updates and announcements from your child's school."
    >
      <SchoolUpdatesView />
    </PageShell>
  )
}
