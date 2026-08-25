import { Suspense } from "react"
import { TimetableView } from "@/components/parent/timetable-view"

export default function TimetablePage() {
  return (
    <Suspense fallback={null}>
      <TimetableView />
    </Suspense>
  )
}
