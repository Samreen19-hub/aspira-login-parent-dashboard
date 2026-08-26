"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Megaphone, School } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSchoolUpdatesStore } from "@/components/parent/school-updates-store"
import { SchoolUpdateDetailsDialog } from "@/components/parent/school-update-details-dialog"
import { formatUpdateDate, formatUpdateTime, type SchoolUpdate } from "@/lib/school-updates"
import { cn } from "@/lib/utils"

/** Sentinel filter value meaning "show every school the parent's children attend". */
const ALL = "all"

export function SchoolUpdatesView() {
  const { updates, schools, isRead, markRead, hydrated } = useSchoolUpdatesStore()
  const [active, setActive] = useState<SchoolUpdate | null>(null)
  const [open, setOpen] = useState(false)
  // Default selection is All Schools; options are derived dynamically from the parent's children.
  const [selected, setSelected] = useState<string>(ALL)

  // If the selected school is no longer among the parent's children (e.g. a child was removed),
  // fall back to All Schools so the view can never point at an inaccessible school.
  const activeFilter = selected !== ALL && !schools.includes(selected) ? ALL : selected

  const visible = useMemo(
    () => (activeFilter === ALL ? updates : updates.filter((update) => update.school === activeFilter)),
    [updates, activeFilter],
  )

  function openUpdate(update: SchoolUpdate) {
    setActive(update)
    setOpen(true)
    markRead(update.id)
  }

  // Avoid a mismatched pre-hydration flash of the empty state before read/child state loads.
  if (!hydrated) return null

  return (
    <div className="space-y-5">
      {/* School filter — only shown when the parent has at least one child/school. Options are
          generated from the parent's children (Parent → Child → School), never hardcoded. */}
      {schools.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Filter school updates by school"
        >
          {[ALL, ...schools].map((school) => {
            const isActive = activeFilter === school
            return (
              <button
                key={school}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelected(school)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand text-brand-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {school === ALL ? "All Schools" : school}
              </button>
            )
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <Megaphone className="size-7" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {activeFilter === ALL ? "No school updates yet" : `No updates from ${activeFilter}`}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            {activeFilter === ALL
              ? "New notices and announcements from your children's schools will appear here."
              : "New notices and announcements from this school will appear here."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((update) => {
            const unread = !isRead(update.id)
            return (
              <Card
                key={update.id}
                className={cn("gap-3 p-5 transition-colors", unread && "ring-2 ring-brand/25")}
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
      )}

      <SchoolUpdateDetailsDialog update={active} open={open} onOpenChange={setOpen} />
    </div>
  )
}
