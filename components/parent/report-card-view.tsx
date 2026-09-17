"use client"

import { useState } from "react"
import { Download, Eye, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
  overallGrade,
  reportCardPercentage,
  type DemoReportCard,
} from "@/lib/demo-academics"

type ReportCardChild = {
  name: string
  className: string
  school: string
}

/**
 * Report Card list + viewer (client).
 *
 * The parent server page verifies child ownership and passes the child's basic
 * details plus DEMO/UI-only report cards (matched by child name in
 * lib/demo-academics). There is no report-card database or file store, so:
 *  - "View" opens an in-page modal rendering a realistic demo report card, and
 *  - "Download" builds a self-contained HTML file in the browser and triggers a
 *    real download — no fake DB record is ever created.
 *
 * When there are no demo cards for this child, the existing empty state is
 * preserved so ordinary parents never see dummy data.
 */
export function ReportCardView({ child, cards }: { child: ReportCardChild; cards: DemoReportCard[] }) {
  const [openCard, setOpenCard] = useState<DemoReportCard | null>(null)

  if (cards.length === 0) {
    return (
      <Card className="items-center gap-3 p-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
          <FileText className="size-7" />
        </span>
        <h2 className="font-display text-lg font-semibold text-foreground">No report card yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Your report card will appear here when your school posts it.
        </p>
      </Card>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          Demo data
        </Badge>
        <p className="text-sm text-muted-foreground">Sample report cards shown for demonstration.</p>
      </div>

      <div className="flex flex-col gap-3">
        {cards.map((card) => {
          const percentage = reportCardPercentage(card)
          return (
            <Card key={card.id} className="gap-0 p-0">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-muted text-brand">
                    <FileText className="size-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-foreground">
                        Academic Year {card.year}
                      </h3>
                      <Badge variant={card.status === "Published" ? "default" : "outline"}>{card.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{card.institution}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{card.level}</Badge>
                      <Badge variant="outline">{card.term}</Badge>
                      <Badge variant="outline">
                        {percentage}% · {overallGrade(percentage)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setOpenCard(card)}
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                  <Button className="rounded-xl" onClick={() => downloadReportCard(child, card)}>
                    <Download className="size-4" />
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Dialog open={openCard !== null} onOpenChange={(open) => !open && setOpenCard(null)}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          {openCard && (
            <>
              <DialogHeader className="gap-1 border-b border-border p-5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="font-display text-lg font-bold">Report Card</DialogTitle>
                  <Badge variant="secondary" className="font-normal">
                    Demo data
                  </Badge>
                </div>
                <DialogDescription>
                  {child.name} · {openCard.institution}
                </DialogDescription>
              </DialogHeader>

              <ReportCardSheet child={child} card={openCard} />

              <DialogFooter className="border-t border-border">
                <DialogClose render={<Button variant="outline" className="rounded-xl" />}>Close</DialogClose>
                <Button className="rounded-xl" onClick={() => downloadReportCard(child, openCard)}>
                  <Download className="size-4" />
                  Download
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Report-card sheet (in-modal viewer)                                        */
/* -------------------------------------------------------------------------- */

function ReportCardSheet({ child, card }: { child: ReportCardChild; card: DemoReportCard }) {
  const percentage = reportCardPercentage(card)
  return (
    <div className="p-5">
      {/* Student + exam meta */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-3">
        <Meta label="Student" value={child.name} />
        <Meta label="Class / Grade" value={card.level} />
        <Meta label="Academic Year" value={card.year} />
        <Meta label="Examination" value={card.term} />
        <Meta label="Status" value={card.status} />
        <Meta label="Class Teacher" value={card.teacher} />
      </div>

      {/* Marks table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-muted/40 text-left text-muted-foreground">
              <th className="p-3 font-semibold">Subject</th>
              <th className="p-3 text-center font-semibold">Marks</th>
              <th className="p-3 text-center font-semibold">Max</th>
              <th className="p-3 text-center font-semibold">Grade</th>
            </tr>
          </thead>
          <tbody>
            {card.subjects.map((subject) => (
              <tr key={subject.subject} className="border-t border-border">
                <td className="p-3 font-medium text-foreground">{subject.subject}</td>
                <td className="p-3 text-center text-foreground">{subject.marks}</td>
                <td className="p-3 text-center text-muted-foreground">{subject.max}</td>
                <td className="p-3 text-center font-semibold text-foreground">{subject.grade}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/40 font-semibold text-foreground">
              <td className="p-3">Overall</td>
              <td className="p-3 text-center" colSpan={2}>
                {percentage}%
              </td>
              <td className="p-3 text-center">{overallGrade(percentage)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Remarks */}
      <div className="mt-4 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class Teacher&apos;s Remarks</p>
        <p className="mt-1 text-sm text-foreground text-pretty">{card.remarks}</p>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Client-side download (self-contained HTML, no DB record)                   */
/* -------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Build a printable, self-contained HTML report card for download. */
function buildReportCardHtml(child: ReportCardChild, card: DemoReportCard): string {
  const percentage = reportCardPercentage(card)
  const rows = card.subjects
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.subject)}</td><td class="c">${s.marks}</td><td class="c">${s.max}</td><td class="c">${escapeHtml(
          s.grade,
        )}</td></tr>`,
    )
    .join("")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Report Card — ${escapeHtml(child.name)} (${escapeHtml(card.year)})</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 32px; background: #f8fafc; }
  .sheet { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; }
  .demo { display: inline-block; font-size: 12px; font-weight: 600; color: #6d28d9; background: #ede9fe; border-radius: 999px; padding: 2px 10px; margin-bottom: 12px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; margin: 0 0 20px; font-size: 14px; }
  .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; background: #f9fafb; border-radius: 12px; padding: 16px; font-size: 14px; }
  .meta .k { color: #6b7280; font-size: 12px; display: block; }
  .meta .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { background: #f5f3ff; }
  td.c, th.c { text-align: center; }
  tfoot td { font-weight: 700; background: #f9fafb; }
  .remarks { margin-top: 20px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
  .remarks .k { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; margin: 0 0 4px; }
  .foot { margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
  <div class="sheet">
    <span class="demo">Demo data</span>
    <h1>Report Card</h1>
    <p class="sub">${escapeHtml(child.name)} · ${escapeHtml(card.institution)}</p>
    <div class="meta">
      <div><span class="k">Student</span><span class="v">${escapeHtml(child.name)}</span></div>
      <div><span class="k">Class / Grade</span><span class="v">${escapeHtml(card.level)}</span></div>
      <div><span class="k">Academic Year</span><span class="v">${escapeHtml(card.year)}</span></div>
      <div><span class="k">Examination</span><span class="v">${escapeHtml(card.term)}</span></div>
      <div><span class="k">Status</span><span class="v">${escapeHtml(card.status)}</span></div>
      <div><span class="k">Class Teacher</span><span class="v">${escapeHtml(card.teacher)}</span></div>
    </div>
    <table>
      <thead><tr><th>Subject</th><th class="c">Marks</th><th class="c">Max</th><th class="c">Grade</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Overall</td><td class="c">${percentage}%</td><td class="c"></td><td class="c">${escapeHtml(
        overallGrade(percentage),
      )}</td></tr></tfoot>
    </table>
    <div class="remarks">
      <p class="k">Class Teacher's Remarks</p>
      <p>${escapeHtml(card.remarks)}</p>
    </div>
    <p class="foot">This is demo/test data generated for demonstration purposes only.</p>
  </div>
</body>
</html>`
}

function downloadReportCard(child: ReportCardChild, card: DemoReportCard) {
  const html = buildReportCardHtml(child, card)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const safeName = child.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "")
  const safeYear = card.year.replace(/[^0-9]+/g, "-").replace(/^-+|-+$/g, "")
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${safeName || "report-card"}-Report-Card-${safeYear}.html`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
