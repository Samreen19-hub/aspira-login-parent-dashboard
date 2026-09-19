"use client"

import { useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  Download,
  Eye,
  FileText,
  Link2Off,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  addReportCard,
  deleteReportCard,
  listReportCards,
  updateReportCard,
  type ReportCard,
  type ReportCardContext,
} from "@/app/actions/report-cards"

const ACCEPT = "image/png,image/jpeg,application/pdf"

function isImage(fileType: string) {
  return fileType.startsWith("image/")
}

function fileUrl(id: string, download = false) {
  return `/api/reports/${id}/file${download ? "?download=1" : ""}`
}

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function ReportCardView({ context }: { context: ReportCardContext }) {
  const { childId, linked, options } = context

  // Distinct academic years (newest label first) derived from real enrollments.
  const years = useMemo(() => {
    const set = new Set(options.map((o) => o.academicYear))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [options])

  const [year, setYear] = useState<string>(() => years[0] ?? "")

  // Classes available for the selected year (again from real enrollments).
  const classes = useMemo(() => {
    const set = new Set(
      options.filter((o) => o.academicYear === year).map((o) => o.className),
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [options, year])

  const [className, setClassName] = useState<string>(() => classes[0] ?? "")

  // Keep the selected class valid whenever the year (and thus classes) changes.
  const effectiveClass = classes.includes(className) ? className : (classes[0] ?? "")

  const canQuery = linked && Boolean(year) && Boolean(effectiveClass)
  const swrKey = canQuery ? ["report-cards", childId, year, effectiveClass] : null

  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () => listReportCards(childId, { academicYear: year, className: effectiveClass }),
    { revalidateOnFocus: false },
  )

  const cards = data ?? []

  /* ---- Unlinked child: no canonical student yet -------------------------- */
  if (!linked) {
    return (
      <Card className="items-center gap-3 p-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <Link2Off className="size-7" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">
          Not linked to a student yet
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          This child isn&apos;t connected to a school student record yet, so there are no
          report cards to show. Once the school links this child to a student and enrollment,
          their report cards will appear here.
        </p>
      </Card>
    )
  }

  /* ---- Linked but no enrollments: no year/class options ------------------ */
  if (options.length === 0) {
    return (
      <Card className="items-center gap-3 p-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <FileText className="size-7" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">
          No classes available yet
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          This student has no enrollment records yet. Report cards become available once an
          academic year and class are set up for them.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <Field label="Academic Year">
            <NativeSelect
              value={year}
              onChange={(value) => setYear(value)}
              options={years}
            />
          </Field>
          <Field label="Class">
            <NativeSelect
              value={effectiveClass}
              onChange={(value) => setClassName(value)}
              options={classes}
            />
          </Field>
        </div>

        <AddReportCardButton
          childId={childId}
          academicYear={year}
          className={effectiveClass}
          onSaved={() => mutate()}
        />
      </div>

      {/* List / states */}
      {isLoading ? (
        <Card className="items-center gap-2 p-12 text-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading report cards…</p>
        </Card>
      ) : cards.length === 0 ? (
        <EmptyState
          childId={childId}
          academicYear={year}
          className={effectiveClass}
          onSaved={() => mutate()}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((card) => (
            <ReportCardRow key={card.id} card={card} childId={childId} onChanged={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Report card row                                                            */
/* -------------------------------------------------------------------------- */

function ReportCardRow({
  card,
  childId,
  onChanged,
}: {
  card: ReportCard
  childId: string
  onChanged: () => void
}) {
  const [viewOpen, setViewOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function onDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteReportCard(card.id, childId)
      onChanged()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
            <FileText className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-bold text-foreground">{card.title}</h3>
              <Badge variant="outline">{isImage(card.fileType) ? "Image" : "PDF"}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Academic Year {card.academicYear}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{card.className}</Badge>
              {card.section ? <Badge variant="outline">Section {card.section}</Badge> : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setViewOpen(true)}>
            <Eye className="size-4" />
            View
          </Button>
          <Button className="rounded-xl" render={<a href={fileUrl(card.id, true)} download />}>
            <Download className="size-4" />
            Download
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            aria-label="Edit report card"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl text-destructive hover:text-destructive"
            aria-label="Delete report card"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </Button>
        </div>
      </div>

      {/* View dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="gap-1 border-b border-border p-5">
            <DialogTitle className="font-display text-lg font-bold">{card.title}</DialogTitle>
            <DialogDescription>
              Academic Year {card.academicYear} · {card.className}
              {card.section ? ` · Section ${card.section}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[60vh] bg-muted/30">
            {isImage(card.fileType) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl(card.id) || "/placeholder.svg"}
                alt={`${card.title} report card`}
                className="mx-auto max-h-[70vh] w-auto object-contain p-4"
              />
            ) : (
              <iframe
                src={fileUrl(card.id)}
                title={`${card.title} report card`}
                className="h-[70vh] w-full"
              />
            )}
          </div>

          <DialogFooter className="border-t border-border">
            <DialogClose render={<Button variant="outline" className="rounded-xl" />}>
              Close
            </DialogClose>
            <Button className="rounded-xl" render={<a href={fileUrl(card.id, true)} download />}>
              <Download className="size-4" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <ReportCardFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        childId={childId}
        academicYear={card.academicYear}
        className={card.className}
        report={card}
        onSaved={() => {
          setEditOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*  Empty state (no card for this year+class)                                  */
/* -------------------------------------------------------------------------- */

function EmptyState({
  childId,
  academicYear,
  className,
  onSaved,
}: {
  childId: string
  academicYear: string
  className: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="items-center gap-3 p-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
        <FileText className="size-7" />
      </span>
      <h2 className="font-display text-lg font-semibold text-foreground">
        No report card available
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground text-pretty">
        There is no report card for {className} · Academic Year {academicYear} yet. Upload one to
        get started.
      </p>
      <Button className="mt-1 rounded-xl" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Report Card
      </Button>
      <ReportCardFormDialog
        mode="add"
        open={open}
        onOpenChange={setOpen}
        childId={childId}
        academicYear={academicYear}
        className={className}
        onSaved={() => {
          setOpen(false)
          onSaved()
        }}
      />
    </Card>
  )
}

function AddReportCardButton({
  childId,
  academicYear,
  className,
  onSaved,
}: {
  childId: string
  academicYear: string
  className: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={() => setOpen(true)}
        disabled={!academicYear || !className}
      >
        <Plus className="size-4" />
        Add Report Card
      </Button>
      <ReportCardFormDialog
        mode="add"
        open={open}
        onOpenChange={setOpen}
        childId={childId}
        academicYear={academicYear}
        className={className}
        onSaved={() => {
          setOpen(false)
          onSaved()
        }}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Add / Edit form dialog                                                     */
/* -------------------------------------------------------------------------- */

function ReportCardFormDialog({
  mode,
  open,
  onOpenChange,
  childId,
  academicYear,
  className,
  report,
  onSaved,
}: {
  mode: "add" | "edit"
  open: boolean
  onOpenChange: (open: boolean) => void
  childId: string
  academicYear: string
  className: string
  report?: ReportCard
  onSaved: () => void
}) {
  const [title, setTitle] = useState(report?.title ?? "")
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError(null)

    const form = event.currentTarget
    const formData = new FormData(form)
    formData.set("childId", childId)

    const file = fileRef.current?.files?.[0]
    if (mode === "add" && !file) {
      setError("Please choose a PNG, JPG or PDF file.")
      return
    }

    setSaving(true)
    try {
      if (mode === "add") {
        formData.set("academicYear", academicYear)
        formData.set("className", className)
        await addReportCard(formData)
      } else if (report) {
        formData.set("reportId", report.id)
        await updateReportCard(formData)
      }
      onSaved()
      // Reset local state for the next open.
      setTitle(mode === "edit" ? title : "")
      setFileName(null)
      if (fileRef.current) fileRef.current.value = ""
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "add" ? "Add Report Card" : "Edit Report Card"}
          </DialogTitle>
          <DialogDescription>
            {className} · Academic Year {academicYear}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-title">Title</Label>
            <Input
              id="report-title"
              name="title"
              placeholder="e.g. Term 1 Report"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-file">
              {mode === "add" ? "Report file (PNG, JPG or PDF)" : "Replace file (optional)"}
            </Label>
            <label
              htmlFor="report-file"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
            >
              <Upload className="size-4" />
              <span className="truncate">
                {fileName ??
                  (mode === "edit" && report?.originalFilename
                    ? `Current: ${report.originalFilename}`
                    : "Choose a file")}
              </span>
            </label>
            <input
              ref={fileRef}
              id="report-file"
              name="file"
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            />
            {mode === "edit" ? (
              <p className="text-xs text-muted-foreground">
                Leave empty to keep the current file.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="rounded-xl" />}>
              Cancel
            </DialogClose>
            <Button type="submit" className="rounded-xl" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : mode === "add" ? (
                "Upload"
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small presentational helpers                                               */
/* -------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 min-w-40 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm outline-none transition-colors focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
