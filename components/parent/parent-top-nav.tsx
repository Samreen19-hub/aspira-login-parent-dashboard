'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Users,
  MessageSquare,
  Bell,
  Search,
  ChevronDown,
  UserRound,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'
import { AspiraLogo } from '@/components/brand/aspira-logo'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth-context'
import { PARENT_PROFILE } from '@/lib/parent-data'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Home', href: '/parent', icon: Home },
  { label: 'Network', href: '/parent/network', icon: Users },
  { label: 'Messages', href: '/parent/messages', icon: MessageSquare },
  { label: 'Notifications', href: '/parent/notifications', icon: Bell, badge: 6 },
]

export function ParentTopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-6">
        <Link href="/parent" aria-label="Aspira home" className="shrink-0">
          <AspiraLogo showTagline={false} size={32} />
        </Link>

        <div className="relative ml-1 hidden max-w-md flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search Aspira"
            placeholder="Search students, schools, teachers, posts..."
            className="h-11 w-full rounded-xl border border-transparent bg-muted pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
          />
        </div>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-colors',
                  active ? 'text-brand' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {item.badge && (
                    <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </span>
                {item.label}
                {active && (
                  <span className="absolute -bottom-[9px] left-2 right-2 h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="h-11 gap-2 rounded-xl px-2 hover:bg-muted" />
              }
            >
              <Avatar size="default">
                <AvatarImage src={user?.avatar || PARENT_PROFILE.avatar} alt="" />
                <AvatarFallback>{(user?.name || 'P')[0]}</AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold text-foreground">
                  {user?.name || PARENT_PROFILE.name}
                </span>
                <span className="block text-xs text-muted-foreground">Parent</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Avatar size="default">
                  <AvatarImage src={user?.avatar || PARENT_PROFILE.avatar} alt="" />
                  <AvatarFallback>{(user?.name || 'P')[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/parent/profile" />}>
                <UserRound className="size-4" /> My Profile
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/parent/children" />}>
                <Users className="size-4" /> My Children
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/parent/profile" />}>
                <Settings className="size-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile nav menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="rounded-xl lg:hidden" />}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {NAV.map((item) => {
                const Icon = item.icon
                return (
                  <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                    <Icon className="size-4" /> {item.label}
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
