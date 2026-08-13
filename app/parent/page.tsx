import { LeftSidebar } from "@/components/parent/left-sidebar"
import { RightSidebar } from "@/components/parent/right-sidebar"
import { HomeFeed } from "@/components/parent/home-feed"

export default function ParentHomePage() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <div className="hidden lg:block">
        <div className="sticky top-22 space-y-5">
          <LeftSidebar />
        </div>
      </div>

      <HomeFeed />

      <div className="hidden xl:block">
        <div className="sticky top-22 space-y-5">
          <RightSidebar />
        </div>
      </div>
    </div>
  )
}
