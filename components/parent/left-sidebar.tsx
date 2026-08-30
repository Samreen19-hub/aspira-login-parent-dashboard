'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { Users, CalendarDays, UsersRound, Globe, Bookmark, ArrowRight, Megaphone, CalendarHeart } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth-context'
import { PARENT_PROFILE } from '@/lib/parent-data'
import { cn } from '@/lib/utils'

const QUICK_ACTIONS = [
  { label: 'My Children', href: '/parent/children', icon: Users },
  { label: 'My Network', href: '/parent/network', icon: Users },
  { label: 'School Updates', href: '/parent/school-updates', icon: Megaphone },
  { label: 'Events', href: '/parent/events', icon: CalendarHeart },
  { label: 'Timetable', href: '/parent/timetable', icon: CalendarDays },
  { label: 'Groups', href: '/parent/groups', icon: UsersRound },
  { label: 'Communities', href: '/parent/communities', icon: Globe },
  { label: 'Saved Posts', href: '/parent/saved-posts', icon: Bookmark },
]

export function LeftSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const name = user?.name || PARENT_PROFILE.name
  const avatar = user?.avatar || PARENT_PROFILE.avatar

  return (
    <aside className="flex flex-col gap-4">
      {/* Profile card */}
      <Card className="gap-0 p-5">
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="size-14">
            <AvatarImage src={avatar} alt={name} />
            <AvatarFallback>{name[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold text-foreground">{name}</p>
            <p className="text-sm text-muted-foreground">Parent</p>
            <Badge className="mt-1 bg-brand-muted text-brand" variant="secondary">
              Parent Account
            </Badge>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Profile Completion</span>
            <span className="font-semibold text-foreground">{PARENT_PROFILE.profileCompletion}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${PARENT_PROFILE.profileCompletion}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Quick actions */}
      <Card className="gap-0 p-3">
        <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand">
          Quick Actions
        </p>
        <nav className="mt-1 grid gap-0.5">
          {QUICK_ACTIONS.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-muted text-brand'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className={cn('size-5', active ? 'text-brand' : 'text-muted-foreground')} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </Card>

      {/* Join groups promo */}
      <Card className="relative gap-0 overflow-hidden border-0 bg-brand p-5 text-brand-foreground ring-0">
        <h3 className="font-display text-lg font-bold">Join Groups &amp; Communities</h3>
        <p className="mt-1.5 text-sm text-brand-foreground/85">
          Connect with other parents, share experiences and stay updated.
        </p>
        <Button
          render={<Link href="/parent/communities" />}
          className="mt-4 w-fit gap-1.5 rounded-xl bg-card text-brand hover:bg-card/90"
        >
          Explore Now <ArrowRight className="size-4" />
        </Button>
        <Image
          src="/aspira-illustration.png"
          alt=""
          width={120}
          height={120}
          className="pointer-events-none absolute -bottom-3 -right-3 size-24 object-contain opacity-90"
        />
      </Card>
    </aside>
  )
}
