import type { ReactNode } from "react"
import { RequireAuth } from "@/components/parent/require-auth"
import { ParentTopNav } from "@/components/parent/parent-top-nav"
import { FeedStoreProvider } from "@/components/parent/feed-store"
import { SocialStoreProvider } from "@/components/parent/social-store"

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <FeedStoreProvider>
        <SocialStoreProvider>
        <div className="min-h-svh bg-lavender">
          <ParentTopNav />
          <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">{children}</main>
        </div>
        </SocialStoreProvider>
      </FeedStoreProvider>
    </RequireAuth>
  )
}
