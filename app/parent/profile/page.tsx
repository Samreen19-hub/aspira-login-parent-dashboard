import { UserRound } from "lucide-react"
import { PageShell } from "@/components/parent/page-shell"

function safeParentReturnTo(returnTo?: string) {
  return returnTo === "/parent" || returnTo?.startsWith("/parent/")
    ? returnTo
    : "/parent"
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams
  const backHref = safeParentReturnTo(returnTo)

  return (
    <PageShell
      title="My Profile"
      description="Manage your parent profile and account preferences."
      icon={UserRound}
      backHref={backHref}
      backLabel={backHref === "/parent" ? "Back to home" : "Back to previous page"}
    />
  )
}
