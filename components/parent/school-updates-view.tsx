"use client"

import { useState } from "react"
import Image from "next/image"
import { Megaphone, School } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSchoolUpdatesStore } from "@/components/parent/school-updates-store"
import { SchoolUpdateDetailsDialog } from "@/components/parent/school-update-details-dialog"
import { formatUpdateDate, formatUpdateTime, type SchoolUpdate } from "@/lib/school-updates"
import { cn } from "@/lib/utils"

export function SchoolUpdatesView() {
  const { updates, isRead, markRead, hydrated } = useSchoolUpdatesStore()
  const [active, setActive] = useState<SchoolUpdate | null>(null)
  const [open, setOpen] = useState(false)

  function openUpdate(update: SchoolUpdate) {
    setActive(update)
    setOpen(true)
    markRead(update.id)
  }

  // Avoid a mismatched pre-hydration flash of the empty state before read/child state loads.
  if (!hydrated) return null

  if (updates.length === 0) {
    return (
      <Card className="items-center gap-3 p-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <Megaphone className="size-7" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">No school updates yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          New notices and announcements from your child&apos;s school will appear here.
        </p>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        {updates.map((update) => {
          const unread = !isRead(update.id)
          return (
            <Card
              key={update.id}
              className={cn(
                "gap-3 p-5 transition-colors",
                unread && "ring-2 ring-brand/25",
              )}
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
                  <Megaphone className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-semibold text-foreground">{update.title}</h2>
                    <Badge className="border-0 bg-secondary text-[11px] font-semibold text-secondary-foreground">
                      {update.category}
                    </Badge>
                    {unread && <Badge className="text-[11px] font-semibold">New</Badge>}
                  </div>

                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-brand">
                    <School className="size-3.5 shrink-0" aria-hidden="true" />
                    {update.school}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-muted-foreground text-pretty">
                    {update.preview}
                  </p>

                  {update.image && (
                    <div className="relative mt-3 aspect-[16/9] w-full max-w-sm overflow-hidden rounded-xl bg-secondary">
                      <Image src={update.image || "/placeholder.svg"} alt="" fill className="object-cover" />
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {formatUpdateDate(update.publishedAt)} · {formatUpdateTime(update.publishedAt)}
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-xl text-brand"
                      onClick={() => openUpdate(update)}
                    >
                      Read More
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <SchoolUpdateDetailsDialog update={active} open={open} onOpenChange={setOpen} />
    </>
  )
}
