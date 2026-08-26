import type { ReactNode } from "react"
import { RequireAuth } from "@/components/parent/require-auth"
import { ParentTopNav } from "@/components/parent/parent-top-nav"
import { FeedStoreProvider } from "@/components/parent/feed-store"
import { SocialStoreProvider } from "@/components/parent/social-store"
import { ChildrenStoreProvider } from "@/components/parent/children-store"
import { SchoolUpdatesStoreProvider } from "@/components/parent/school-updates-store"

export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ChildrenStoreProvider>
        <SchoolUpdatesStoreProvider>
          <FeedStoreProvider>
            <SocialStoreProvider>
            <div className="min-h-svh bg-lavender">
              <ParentTopNav />
              <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-6">{children}</main>
            </div>
            </SocialStoreProvider>
          </FeedStoreProvider>
        </SchoolUpdatesStoreProvider>
      </ChildrenStoreProvider>
    </RequireAuth>
  )
}
