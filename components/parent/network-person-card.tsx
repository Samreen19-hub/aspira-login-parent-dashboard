"use client"

import { BadgeCheck, MoreHorizontal, UserRoundPlus, UserRoundCheck, UserRoundX } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NetworkPerson } from "@/lib/network-data"

const MUTUAL_AVATARS = ["/network/neha-sharma.png", "/network/rohan-mehta.png", "/network/kavya-rao.png"]

type Variant = "connection" | "following" | "follower" | "discover"

function primaryLabel(variant: Variant) {
  switch (variant) {
    case "following":
      return "Following"
    case "follower":
      return "Follow back"
    case "discover":
      return "Connect"
    default:
      return "Message"
  }
}

export function NetworkPersonCard({
  person,
  variant = "connection",
}: {
  person: NetworkPerson
  variant?: Variant
}) {
  const isFollowing = variant === "following"

  return (
    <Card className="items-center gap-0 p-4 text-center transition-shadow hover:shadow-md">
      <div className="flex w-full items-start justify-between">
        <span className="size-6" aria-hidden />
        <Avatar className="size-16">
          <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
          <AvatarFallback>{person.name[0]}</AvatarFallback>
        </Avatar>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`More options for ${person.name}`}
                className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>View profile</DropdownMenuItem>
            <DropdownMenuItem>Share profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <UserRoundX className="size-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 flex items-center gap-1">
        <p className="font-display font-semibold text-foreground">{person.name}</p>
        {person.verified && <BadgeCheck className="size-4 fill-brand text-card" aria-label="Verified" />}
      </div>

      <p className="mt-1 text-sm leading-snug text-muted-foreground text-balance">{person.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{person.location}</p>

      <div className="mt-3 flex w-full items-center justify-center gap-2">
        <div className="flex -space-x-2" aria-hidden>
          {MUTUAL_AVATARS.map((src) => (
            <Avatar key={src} className="size-6 ring-2 ring-card">
              <AvatarImage src={src || "/placeholder.svg"} alt="" />
              <AvatarFallback> </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{person.mutualConnections} mutual connections</span>
      </div>

      <div className="mt-4 flex w-full items-center gap-2">
        <Button
          variant={isFollowing ? "outline" : "outline"}
          className="flex-1 gap-1.5 rounded-lg text-brand hover:text-brand"
        >
          {variant === "discover" && <UserRoundPlus className="size-4" />}
          {variant === "follower" && <UserRoundPlus className="size-4" />}
          {isFollowing && <UserRoundCheck className="size-4" />}
          {primaryLabel(variant)}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="More actions"
          className="rounded-lg text-muted-foreground"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
    </Card>
  )
}
