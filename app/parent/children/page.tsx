import Link from "next/link"
import { GraduationCap, School, TrendingUp, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageShell } from "@/components/parent/page-shell"
import { ProgressRing } from "@/components/parent/progress-ring"
import { CHILDREN } from "@/lib/parent-data"

export default function ChildrenPage() {
  return (
    <PageShell title="My Children" description="Track progress and manage your children's accounts.">
      <div className="grid gap-4 sm:grid-cols-2">
        {CHILDREN.map((child) => (
          <Card key={child.id} className="gap-4 p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="size-16">
                  <AvatarImage src={child.avatar || "/placeholder.svg"} alt={child.name} />
                  <AvatarFallback>{child.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-display font-semibold text-foreground">{child.name}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <GraduationCap className="size-4" /> {child.className}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <School className="size-4" /> {child.school}
                  </p>
                </div>
              </div>
              <ProgressRing value={child.progress} size={56} />
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-brand-muted px-3 py-2.5 text-sm text-brand">
              <TrendingUp className="size-4" />
              <span className="font-medium">{child.progress}% overall performance this term</span>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" render={<Link href="/parent/timetable" />}>
                Timetable
              </Button>
              <Button className="flex-1 rounded-xl" render={<Link href="/parent" />}>
                View Feed
              </Button>
            </div>
          </Card>
        ))}

        <button
          type="button"
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <span className="grid size-11 place-items-center rounded-full bg-brand-muted text-brand">
            <Plus className="size-5" />
          </span>
          <span className="text-sm font-medium">Add Another Child</span>
        </button>
      </div>
    </PageShell>
  )
}
