'use client'

import Link from 'next/link'
import { CalendarClock, CalendarDays, FlaskConical, FileText, Plus } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/parent/progress-ring'
import { useChildrenStore } from '@/components/parent/children-store'
import { useSchoolUpdatesStore } from '@/components/parent/school-updates-store'
import { UPCOMING_EVENTS } from '@/lib/parent-data'
import { formatUpdateDate } from '@/lib/school-updates'
import { cn } from '@/lib/utils'

const EVENT_ICON = {
  rose: { icon: CalendarClock, cls: 'bg-rose-100 text-rose-600' },
  blue: { icon: CalendarDays, cls: 'bg-blue-100 text-blue-600' },
  green: { icon: FlaskConical, cls: 'bg-emerald-100 text-emerald-600' },
} as const

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-display font-semibold text-foreground">{title}</h3>
      <Link href={href} className="text-xs font-semibold text-brand hover:underline">
        View All
      </Link>
    </div>
  )
}

export function RightSidebar() {
  // Same persisted source of truth used by My Children and the Timetable selector, so a newly
  // added child shows up here immediately (and after navigation/refresh) with no separate list.
  const { children } = useChildrenStore()
  // The School Notifications preview reads the SAME published School Updates data as the full page,
  // scoped to the child's school. Newest first; only a short preview is shown here.
  const { updates, isRead } = useSchoolUpdatesStore()
  const notificationPreview = updates.slice(0, 3)

  return (
    <aside className="flex flex-col gap-4">
      {/* My Children */}
      <Card className="p-5">
        <SectionHeader title="My Children" href="/parent/children" />
        <div className="grid gap-3">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/parent/children`}
              className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-muted"
            >
              <div className="relative">
                <Avatar size="lg" className="size-11">
                  <AvatarImage src={child.avatar} alt={child.name} />
                  <AvatarFallback>{child.name[0]}</AvatarFallback>
                </Avatar>
                {child.online && (
                  <span className="absolute bottom-0 right-0 size-3 rounded-full bg-success ring-2 ring-card" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{child.name}</p>
                <p className="text-xs text-muted-foreground">{child.className}</p>
                <p className="truncate text-xs text-muted-foreground">{child.school}</p>
              </div>
              <ProgressRing value={child.progress} />
            </Link>
          ))}
        </div>
        <Button
          render={<Link href="/parent/children" />}
          variant="outline"
          className="mt-4 w-full gap-1.5 rounded-xl border-dashed border-brand/40 text-brand hover:bg-brand-muted"
        >
          <Plus className="size-4" /> Add Another Child
        </Button>
      </Card>

      {/* Upcoming Events */}
      <Card className="p-5">
        <SectionHeader title="Upcoming Events" href="/parent/events" />
        <div className="grid gap-3">
          {UPCOMING_EVENTS.map((event) => {
            const meta = EVENT_ICON[event.tone]
            const Icon = meta.icon
            return (
              <div key={event.id} className="flex items-center gap-3">
                <span className={cn('flex size-9 items-center justify-center rounded-lg', meta.cls)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.date} · {event.time}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        <Button
          render={<Link href="/parent/events" />}
          variant="outline"
          className="mt-4 w-full rounded-xl text-brand"
        >
          See All Events
        </Button>
      </Card>

      {/* School Notifications */}
      <Card className="p-5">
        <SectionHeader title="School Notifications" href="/parent/school-updates" />
        <div className="grid gap-3">
          {notificationPreview.map((n) => (
            <div key={n.id} className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{formatUpdateDate(n.publishedAt)}</p>
              </div>
              {!isRead(n.id) && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
            </div>
          ))}
        </div>
        <Button
          render={<Link href="/parent/school-updates" />}
          variant="outline"
          className="mt-4 w-full rounded-xl text-brand"
        >
          See All Notifications
        </Button>
      </Card>
    </aside>
  )
}
