import { CalendarClock, CalendarDays, FlaskConical, Trophy } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/parent/page-shell"
import { UPCOMING_EVENTS } from "@/lib/parent-data"

const icons = { rose: CalendarClock, blue: CalendarDays, green: FlaskConical } as const
export default function EventsPage() {
  return <PageShell title="Upcoming Events" description="Stay up to date with school activities and important dates."><div className="grid gap-4 md:grid-cols-2">{UPCOMING_EVENTS.map((event) => { const Icon = icons[event.tone]; return <Card key={event.id} className="gap-3 p-5"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand"><Icon className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display font-semibold text-foreground">{event.title}</h2><Badge variant="secondary">{event.type ?? "School Event"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{event.date} · {event.time}</p><p className="mt-2 text-sm text-muted-foreground">{event.school ?? "Greenfield Public School"} · {event.location ?? "School campus"}</p></div></div></Card> })}<Card className="gap-3 border-dashed p-5 md:col-span-2"><div className="flex items-center gap-3"><Trophy className="size-5 text-brand" /><h2 className="font-display font-semibold text-foreground">More academic and sports events coming soon</h2></div><p className="text-sm text-muted-foreground">New competitions, exhibitions, and school activities will appear here.</p></Card></div></PageShell>
}
