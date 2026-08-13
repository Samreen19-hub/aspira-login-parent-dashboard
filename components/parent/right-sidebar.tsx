'use client'

import Link from 'next/link'
import { CalendarClock, CalendarDays, FlaskConical, FileText, Plus } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProgressRing } from '@/components/parent/progress-ring'
import { CHILDREN, UPCOMING_EVENTS, SCHOOL_NOTIFICATIONS } from '@/lib/parent-data'
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
  return (
    <aside className="flex flex-col gap-4">
      {/* My Children */}
      <Card className="p-5">
        <SectionHeader title="My Children" href="/parent/children" />
        <div className="grid gap-3">
          {CHILDREN.map((child) => (
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
        <SectionHeader title="Upcoming Events" href="/parent/timetable" />
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
          render={<Link href="/parent/timetable" />}
          variant="outline"
          className="mt-4 w-full rounded-xl text-brand"
        >
          See All Events
        </Button>
      </Card>

      {/* School Notifications */}
      <Card className="p-5">
        <SectionHeader title="School Notifications" href="/parent/notifications" />
        <div className="grid gap-3">
          {SCHOOL_NOTIFICATIONS.map((n) => (
            <div key={n.id} className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                <p className="text-xs text-muted-foreground">{n.time}</p>
              </div>
              {n.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
            </div>
          ))}
        </div>
        <Button
          render={<Link href="/parent/notifications" />}
          variant="outline"
          className="mt-4 w-full rounded-xl text-brand"
        >
          See All Notifications
        </Button>
      </Card>
    </aside>
  )
}
