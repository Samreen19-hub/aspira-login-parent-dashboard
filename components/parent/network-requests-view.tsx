"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BadgeCheck, Check, UserRoundPlus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useNetworkStore } from "@/components/parent/network-store"
import { personProfileHref, type NetworkPerson } from "@/lib/network-data"

// Connection requests view for the Parent Network. Reuses the single NetworkStoreProvider (mounted
// in /parent/network/layout.tsx) so Accept/Decline stay synchronized with the main Network page and
// no relationship data is duplicated.
export function NetworkRequestsView() {
  const { requests, acceptRequest, declineRequest } = useNetworkStore()

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          render={<Link href="/parent/network" aria-label="Back to My Network" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-balance">
            Connection Requests
          </h1>
          <p className="text-sm text-muted-foreground">
            {requests.length > 0
              ? `You have ${requests.length} pending ${requests.length === 1 ? "request" : "requests"}.`
              : "You're all caught up."}
          </p>
        </div>
      </div>

      {requests.length > 0 ? (
        <div className="flex flex-col gap-3">
          {requests.map((person) => (
            <RequestRow
              key={person.id}
              person={person}
              onAccept={() => acceptRequest(person.id)}
              onDecline={() => declineRequest(person.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <UserRoundPlus className="size-7" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">No pending requests</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            When someone asks to connect, their request will show up here.
          </p>
          <Button className="mt-1 rounded-xl" render={<Link href="/parent/network" />}>
            Back to My Network
          </Button>
        </Card>
      )}
    </div>
  )
}

function RequestRow({
  person,
  onAccept,
  onDecline,
}: {
  person: NetworkPerson
  onAccept: () => void
  onDecline: () => void
}) {
  const router = useRouter()
  const profileHref = personProfileHref(person.id)

  return (
    <Card className="flex-row items-center gap-4 p-4">
      <button
        type="button"
        onClick={() => router.push(profileHref)}
        className="shrink-0 rounded-full outline-none ring-brand/40 transition-opacity hover:opacity-90 focus-visible:ring-2"
        aria-label={`View ${person.name}'s profile`}
      >
        <Avatar className="size-14">
          <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
          <AvatarFallback>{person.name[0]}</AvatarFallback>
        </Avatar>
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => router.push(profileHref)}
          className="flex items-center gap-1 rounded-md outline-none ring-brand/40 hover:underline focus-visible:ring-2"
        >
          <span className="truncate font-display font-semibold text-foreground">{person.name}</span>
          {person.verified && (
            <BadgeCheck className="size-4 shrink-0 fill-brand text-card" aria-label="Verified" />
          )}
        </button>
        <p className="truncate text-sm text-muted-foreground">{person.headline}</p>
        <p className="text-xs text-muted-foreground">
          {person.location} &middot; {person.mutualConnections} mutual connections
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button onClick={onAccept} className="gap-1.5 rounded-lg">
          <Check className="size-4" />
          Accept
        </Button>
        <Button
          variant="outline"
          onClick={onDecline}
          className="gap-1.5 rounded-lg"
        >
          <X className="size-4" />
          Decline
        </Button>
      </div>
    </Card>
  )
}
