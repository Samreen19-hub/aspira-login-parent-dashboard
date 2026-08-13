import Link from "next/link"
import { ArrowLeft, Construction } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function PageShell({
  title,
  description,
  icon: Icon = Construction,
  children,
}: {
  title: string
  description?: string
  icon?: React.ElementType
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl"
          render={<Link href="/parent" aria-label="Back to home" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-balance">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      {children ?? (
        <Card className="items-center gap-3 p-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-muted text-brand">
            <Icon className="size-7" />
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">Coming soon</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This section is part of the Aspira prototype and will be available in an upcoming release.
          </p>
          <Button className="mt-1 rounded-xl" render={<Link href="/parent" />}>
            Back to Home
          </Button>
        </Card>
      )}
    </div>
  )
}
