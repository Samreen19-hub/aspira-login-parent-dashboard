"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  BadgeCheck,
  MoreHorizontal,
  UserRoundPlus,
  UserRoundCheck,
  UserRoundX,
  UserRound,
  Share2,
  Check,
  Copy,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNetworkStore } from "@/components/parent/network-store"
import { personMessageHref, personProfileHref, type NetworkPerson } from "@/lib/network-data"

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
  const router = useRouter()
  const { removeConnection, sendRequest } = useNetworkStore()
  const [shareOpen, setShareOpen] = useState(false)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const isFollowing = variant === "following"
  const relationshipStatus = person.relationshipStatus ?? "none"
  const profileHref = personProfileHref(person.id, "/parent/network")
  // Absolute URL for the share dialog; falls back to the app path during SSR.
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${profileHref}` : profileHref

  function viewProfile() {
    router.push(profileHref)
  }

  function messagePerson() {
    router.push(personMessageHref(person.id))
  }

  async function connectPerson() {
    if (requestSubmitting || person.relationshipStatus !== "none") return
    setRequestSubmitting(true)
    setRequestError(null)
    try {
      await sendRequest(person.id)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Could not send the connection request.")
    } finally {
      setRequestSubmitting(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // Clipboard can be blocked (e.g. in an iframe). The confirmation still shows so the action
      // never feels dead; the link remains visible in the field for manual copy.
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Shared menu used by both the top-right and bottom-right triggers so neither is a dead click.
  const menuItems = (
    <>
      <DropdownMenuItem onClick={viewProfile}>
        <UserRound className="size-4" />
        View profile
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setShareOpen(true)}>
        <Share2 className="size-4" />
        Share profile
      </DropdownMenuItem>
      {variant === "connection" && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setRemoveOpen(true)}>
            <UserRoundX className="size-4" />
            Remove
          </DropdownMenuItem>
        </>
      )}
    </>
  )

  return (
    <Card className="items-center gap-0 p-4 text-center transition-shadow hover:shadow-md">
      <div className="flex w-full items-start justify-between">
        <span className="size-6" aria-hidden />
        <button
          type="button"
          onClick={viewProfile}
          className="rounded-full outline-none ring-brand/40 transition-opacity hover:opacity-90 focus-visible:ring-2"
          aria-label={`View ${person.name}'s profile`}
        >
          <Avatar className="size-16">
            <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
            <AvatarFallback>{person.name[0]}</AvatarFallback>
          </Avatar>
        </button>
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
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        onClick={viewProfile}
        className="mt-3 flex items-center gap-1 rounded-md outline-none ring-brand/40 hover:underline focus-visible:ring-2"
      >
        <span className="font-display font-semibold text-foreground">{person.name}</span>
        {person.verified && <BadgeCheck className="size-4 fill-brand text-card" aria-label="Verified" />}
      </button>

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

      {requestError && variant === "discover" && (
        <p className="mt-3 text-xs text-destructive" role="alert">
          {requestError}
        </p>
      )}

      <div className="mt-4 flex w-full items-center gap-2">
        <Button
          variant="outline"
          onClick={
            variant === "discover"
              ? relationshipStatus === "none"
                ? connectPerson
                : relationshipStatus === "pending_incoming"
                  ? () => router.push("/parent/network/requests")
                  : relationshipStatus === "connected"
                    ? messagePerson
                    : undefined
              : variant === "connection"
                ? messagePerson
                : viewProfile
          }
          disabled={variant === "discover" && (requestSubmitting || relationshipStatus === "pending_outgoing")}
          className="flex-1 gap-1.5 rounded-lg text-brand hover:text-brand"
        >
          {requestSubmitting ? <Loader2 className="size-4 animate-spin" /> : relationshipStatus === "none" && variant === "discover" ? <UserRoundPlus className="size-4" /> : isFollowing ? <UserRoundCheck className="size-4" /> : relationshipStatus === "connected" ? <Check className="size-4" /> : null}
          {variant === "discover"
            ? relationshipStatus === "pending_outgoing"
              ? "Request Sent"
              : relationshipStatus === "pending_incoming"
                ? "Respond"
                : relationshipStatus === "connected"
                  ? "Connected"
                  : "Connect"
            : primaryLabel(variant)}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={`More actions for ${person.name}`}
                className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground ring-1 ring-border transition-colors hover:bg-muted hover:text-foreground"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {menuItems}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Share profile dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share profile</DialogTitle>
            <DialogDescription>Share {person.name}&apos;s Aspira profile.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <Avatar className="size-10">
              <AvatarImage src={person.avatar || "/placeholder.svg"} alt={person.name} />
              <AvatarFallback>{person.name[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{person.name}</p>
              <p className="truncate text-sm text-muted-foreground">{person.headline}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareUrl} aria-label="Profile link" className="text-sm" />
            <Button type="button" onClick={copyLink} className="shrink-0 gap-1.5">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          {copied && (
            <p className="text-sm font-medium text-emerald-600" role="status">
              Profile link copied
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirmation dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove connection</DialogTitle>
            <DialogDescription>
              Remove {person.name} from your connections? You can always connect again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                removeConnection(person.id)
                setRemoveOpen(false)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
