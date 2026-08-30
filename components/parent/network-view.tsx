"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Users,
  UserRoundCheck,
  UsersRound,
  Search,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  UserRoundPlus,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { NetworkPersonCard } from "@/components/parent/network-person-card"
import { useNetworkStore } from "@/components/parent/network-store"
import { DISCOVER } from "@/lib/network-data"

const REQUESTS_HREF = "/parent/network/requests"

type TabId = "connections" | "following" | "followers" | "discover"

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "connections", label: "Connections", icon: Users },
  { id: "following", label: "Following", icon: UserRoundCheck },
  { id: "followers", label: "Followers", icon: UsersRound },
  { id: "discover", label: "Discover", icon: Search },
]

const SORT_OPTIONS = ["Recently Added", "Name (A-Z)", "Most Mutual Connections"]

export function NetworkView() {
  const router = useRouter()
  const store = useNetworkStore()
  const [tab, setTab] = useState<TabId>("connections")
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState(SORT_OPTIONS[0])

  const { people, title, variant } = useMemo(() => {
    switch (tab) {
      case "following":
        return { people: store.following, title: "People You Follow", variant: "following" as const }
      case "followers":
        return { people: store.followers, title: "Your Followers", variant: "follower" as const }
      case "discover":
        return { people: DISCOVER, title: "Discover People", variant: "discover" as const }
      default:
        return { people: store.connections, title: "Your Connections", variant: "connection" as const }
    }
  }, [tab, store.following, store.followers, store.connections])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? people.filter(
          (p) => p.name.toLowerCase().includes(q) || p.headline.toLowerCase().includes(q),
        )
      : people

    if (tab !== "connections") return matches

    return [...matches].sort((a, b) => {
      if (sort === "Name (A-Z)") {
        return (
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
          a.id.localeCompare(b.id)
        )
      }

      if (sort === "Most Mutual Connections") {
        return b.mutualConnections - a.mutualConnections || a.id.localeCompare(b.id)
      }

      const aConnectedAt = a.connectedAt ? Date.parse(a.connectedAt) : 0
      const bConnectedAt = b.connectedAt ? Date.parse(b.connectedAt) : 0
      return bConnectedAt - aConnectedAt || a.id.localeCompare(b.id)
    })
  }, [people, query, sort, tab])

  const totalCount =
    tab === "connections"
      ? store.connectionCount
      : tab === "following"
        ? store.followingCount
        : tab === "followers"
          ? store.followerCount
          : filtered.length

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page heading */}
      <header className="mb-5 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          render={<Link href="/parent" aria-label="Back to Parent Home" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Network</h1>
          <p className="mt-1 text-muted-foreground">Connect, discover and grow your network on Aspira.</p>
        </div>
      </header>

      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, schools, companies, universities, groups..."
            className="h-12 rounded-xl bg-card pl-10 text-sm ring-1 ring-foreground/10"
            aria-label="Search your network"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Filters"
          className="size-12 shrink-0 rounded-xl"
        >
          <SlidersHorizontal className="size-5" />
        </Button>
      </div>

      {/* Stats + requests */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_minmax(0,340px)]">
        <Card className="justify-center p-5">
          <div className="grid grid-cols-3 divide-x divide-border">
            <Stat icon={Users} value={store.connectionCount} label="Connections" tone="brand" />
            <Stat icon={UserRoundCheck} value={store.followingCount} label="Following" tone="emerald" />
            <Stat icon={UsersRound} value={store.followerCount} label="Followers" tone="violet" />
          </div>
        </Card>

        <Card className="gap-3 p-5">
          <div className="flex items-center justify-between">
            <p className="font-display font-semibold text-foreground">
              Connection Requests ({store.requestCount})
            </p>
            <button
              type="button"
              onClick={() => router.push(REQUESTS_HREF)}
              className="text-sm font-medium text-brand hover:underline"
            >
              See all
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            {store.requests.length > 0 ? (
              <div className="flex -space-x-3">
                {store.requests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => router.push(REQUESTS_HREF)}
                    className="rounded-full outline-none ring-brand/40 transition-transform hover:z-10 hover:-translate-y-0.5 focus-visible:ring-2"
                    aria-label={`Review request from ${req.name}`}
                  >
                    <Avatar className="size-11 ring-2 ring-card">
                      <AvatarImage src={req.avatar || "/placeholder.svg"} alt={req.name} />
                      <AvatarFallback>{req.name[0]}</AvatarFallback>
                    </Avatar>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pending requests.</p>
            )}
            <Button
              variant="outline"
              size="icon"
              aria-label="View all requests"
              onClick={() => router.push(REQUESTS_HREF)}
              className="size-8 shrink-0 rounded-full"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-5 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* List header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {title} ({totalCount})
        </h2>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Sort by:</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-foreground hover:bg-muted"
                />
              }
            >
              {sort}
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuItem key={option} onClick={() => setSort(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((person) => (
            <NetworkPersonCard key={person.id} person={person} variant={variant} />
          ))}
        </div>
      ) : (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <UserRoundPlus className="size-7" />
          </span>
          <h3 className="font-display text-lg font-semibold text-foreground">No results found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {"We couldn't find anyone matching \""}
            {query}
            {"\". Try a different search."}
          </p>
        </Card>
      )}

      {/* Pagination */}
      {tab === "connections" && filtered.length > 0 && <Pagination />}
    </div>
  )
}

function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ElementType
  value: number
  label: string
  tone: "brand" | "emerald" | "violet"
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "violet"
        ? "text-violet-600"
        : "text-brand"

  return (
    <div className="flex items-center justify-center gap-3 px-2">
      <Icon className={cn("size-6 shrink-0", toneClass)} />
      <div>
        <p className={cn("font-display text-2xl font-bold leading-none", toneClass)}>{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function Pagination() {
  const [page, setPage] = useState(1)
  const pages = [1, 2, 3, 4]
  const last = 16

  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        className="size-9 rounded-lg"
      >
        <ChevronLeft className="size-4" />
      </Button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setPage(p)}
          aria-current={page === p ? "page" : undefined}
          className={cn(
            "grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors",
            page === p ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted",
          )}
        >
          {p}
        </button>
      ))}
      <span className="px-1 text-muted-foreground">...</span>
      <button
        type="button"
        onClick={() => setPage(last)}
        aria-current={page === last ? "page" : undefined}
        className={cn(
          "grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors",
          page === last ? "bg-brand text-brand-foreground" : "text-foreground hover:bg-muted",
        )}
      >
        {last}
      </button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next page"
        disabled={page === last}
        onClick={() => setPage((p) => Math.min(last, p + 1))}
        className="size-9 rounded-lg"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  )
}
