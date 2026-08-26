"use client"

import Image from "next/image"
import { CalendarDays, Clock3, School, Paperclip, Tag } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatUpdateDate, formatUpdateTime, type SchoolUpdate } from "@/lib/school-updates"

/** Full details view for a single published School Update. */
export function SchoolUpdateDetailsDialog({
  update,
  open,
  onOpenChange,
}: {
  update: SchoolUpdate | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!update) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <Badge className="w-fit border-0 bg-brand-muted text-[11px] font-semibold text-brand">
            {update.category}
          </Badge>
          <DialogTitle className="text-balance">{update.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <School className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
            {update.school}
          </DialogDescription>
        </DialogHeader>

        {update.image && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-secondary">
            <Image src={update.image || "/placeholder.svg"} alt="" fill className="object-cover" />
          </div>
        )}

        <div className="grid gap-3">
          <Detail icon={CalendarDays} label={formatUpdateDate(update.publishedAt)} />
          <Detail icon={Clock3} label={formatUpdateTime(update.publishedAt)} />
          <Detail icon={Tag} label={update.category} />
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground text-pretty">
            {update.content}
          </p>

          {update.attachment && (
            <Button
              variant="outline"
              className="w-fit gap-1.5 rounded-xl"
              render={<a href={update.attachment.href} />}
            >
              <Paperclip className="size-4" />
              {update.attachment.name}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Detail({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
