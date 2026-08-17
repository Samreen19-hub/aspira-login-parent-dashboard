import { Bell, FileText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/parent/page-shell"
import { SCHOOL_NOTIFICATIONS } from "@/lib/parent-data"

export default function NotificationsPage() {
  return <PageShell title="School Notifications" description="Important updates and reminders from your children's school."><div className="grid gap-3">{SCHOOL_NOTIFICATIONS.map((notification) => <Card key={notification.id} className="gap-3 p-5"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display font-semibold text-foreground">{notification.title}</h2>{notification.unread && <Badge>Unread</Badge>}</div><p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.description ?? "Please review this update from Greenfield Public School."}</p><p className="mt-2 text-xs text-muted-foreground">{notification.time} · {notification.category ?? "School announcement"}</p></div>{notification.unread && <Bell className="size-4 text-brand" />}</div></Card>)}</div></PageShell>
}
