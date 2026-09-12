"use client"

import { useEffect } from "react"
import { EyeOff, X } from "lucide-react"

/**
 * Temporary "Post hidden" confirmation shown at the feed level after the
 * signed-in user hides a DB-backed post. Offers an Undo (which calls the
 * `unhidePost` server action and revalidates the feed) and auto-dismisses after
 * a few seconds. Purely presentational — all hide/unhide state lives in the DB.
 */
export function PostHiddenNotice({ onUndo, onDismiss }: { onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-brand-muted px-4 py-3 text-sm text-brand">
      <EyeOff className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 font-medium">Post hidden</span>
      <button type="button" onClick={onUndo} className="font-semibold underline underline-offset-2 hover:opacity-80">Undo</button>
      <button type="button" onClick={onDismiss} className="rounded-full p-1 hover:bg-brand/10" aria-label="Dismiss"><X className="size-4" /></button>
    </div>
  )
}
