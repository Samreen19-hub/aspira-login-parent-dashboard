/**
 * School Updates — parent-facing notices and announcements that a School Admin has
 * *intentionally published* from the School Admin Dashboard.
 *
 * This is deliberately separate from:
 *  - the Header Notifications system (likes, comments, connection requests, messages), and
 *  - ordinary School Admin profile/settings changes (logo, description, address, gallery, etc.)
 *    which must NEVER produce a School Update.
 *
 * A School Update is only ever created when the admin publishes a Notice/Announcement. The same
 * records power both the right-sidebar "School Notifications" preview and the full
 * `/parent/school-updates` page, so there is a single source of truth (no duplicate notices).
 */

/** Category/type of a published notice, used for the small labelled chip on each update. */
export type SchoolUpdateCategory =
  | "Meeting"
  | "Announcement"
  | "Circular"
  | "Examination"
  | "Holiday"
  | "Event"

export interface SchoolUpdateAttachment {
  name: string
  href: string
}

/**
 * A single notice/announcement published by a School Admin. `publishedAt` is the actual publish
 * timestamp of the notice (ISO 8601) — updates are always sorted by this, never by any profile
 * modification date.
 */
export interface SchoolUpdate {
  id: string
  /** The school that published the notice. Used to scope updates to the parent's child's school. */
  school: string
  title: string
  /** Short preview shown on the card and in the sidebar. */
  preview: string
  /** Full notice content shown in the details view. */
  content: string
  category: SchoolUpdateCategory
  /** ISO datetime the notice was published (source of truth for sorting + New indicator). */
  publishedAt: string
  /** Optional cover/attachment image supported by the admin notice system. */
  image?: string
  /** Optional file attachment (e.g. a circular PDF) supported by the admin notice system. */
  attachment?: SchoolUpdateAttachment
}

/**
 * Seed of published notices, mirroring what the School Admin Dashboard would have pushed. These
 * represent explicit parent-facing announcements only. Notices span the two schools the demo
 * parent's children attend (Greenfield Public School and Delhi Public School) so the school filter
 * is meaningful, plus one notice from an unrelated school to prove school-scoped access — the
 * parent must never see it.
 */
export const SCHOOL_UPDATES: SchoolUpdate[] = [
  // --- Delhi Public School (Saanvi) ---
  {
    id: "su-dps-sports-day",
    school: "Delhi Public School",
    title: "Annual Sports Day",
    preview: "Annual Sports Day will be held on 20 September 2026. Parents are welcome to attend.",
    content:
      "Dear Parents,\n\nDelhi Public School's Annual Sports Day will be held on 20 September 2026 from 8:30 AM to 1:00 PM on the main sports ground. The day includes track events, house relays, and the primary-wing fun games.\n\nParents are warmly invited to attend and cheer for their children. Kindly note the school gates open at 8:00 AM.",
    category: "Event",
    publishedAt: "2026-08-26T10:00:00",
    image: "/post-robotics.png",
  },
  {
    id: "su-dps-fee-circular",
    school: "Delhi Public School",
    title: "Circular: Term 2 Fee Payment",
    preview: "Term 2 fees are due by 10 September 2026. Online payment is now enabled.",
    content:
      "This is to inform all parents that the Term 2 fee payment window is now open. Fees must be paid on or before 10 September 2026 through the school's online payment portal.\n\nA late fee will be applicable after the due date. For any billing queries, please contact the accounts office during working hours.",
    category: "Circular",
    publishedAt: "2026-08-23T09:00:00",
  },
  // --- Greenfield Public School (Aarav) ---
  {
    id: "su-ptm",
    school: "Greenfield Public School",
    title: "Parent-Teacher Meeting",
    preview: "Parent-Teacher meeting will be held on 18 September 2026.",
    content:
      "Dear Parents,\n\nThe next Parent-Teacher Meeting will be held on 18 September 2026 from 10:00 AM to 12:30 PM in the school auditorium. Please meet your child's class teachers to discuss academic progress, upcoming assessments, and how best to support learning at home.\n\nKindly carry the student diary and arrive 10 minutes before your scheduled slot. We look forward to seeing you.",
    category: "Meeting",
    publishedAt: "2026-08-24T09:30:00",
  },
  {
    id: "su-exam-schedule",
    school: "Greenfield Public School",
    title: "Term 1 Examination Schedule Published",
    preview: "The Term 1 examination timetable is now available for all classes.",
    content:
      "The Term 1 examination schedule has been published for all classes. Examinations will commence on 6 October 2026. The detailed date sheet is attached below.\n\nPlease ensure your child revises according to the timetable. Syllabus details have been shared separately by each subject teacher.",
    category: "Examination",
    publishedAt: "2026-08-22T14:15:00",
    attachment: { name: "Term1-Exam-Datesheet.pdf", href: "#" },
  },
  {
    id: "su-sports-day",
    school: "Greenfield Public School",
    title: "Annual Sports Day Announcement",
    preview: "Annual Sports Day will be celebrated on 12 September 2026. Families are welcome.",
    content:
      "We are delighted to announce our Annual Sports Day on 12 September 2026 from 8:00 AM to 1:00 PM on the school grounds. The day will feature track and field events, team games, and the inter-house championship.\n\nParents and families are warmly invited to attend and cheer on the students. Refreshments will be available on the grounds.",
    category: "Event",
    publishedAt: "2026-08-20T11:00:00",
    image: "/post-robotics.png",
  },
  {
    id: "su-summer-circular",
    school: "Greenfield Public School",
    title: "Circular: Revised School Timings",
    preview: "School timings will change to 8:00 AM – 2:00 PM from 1 September 2026.",
    content:
      "Please note that revised school timings will be effective from 1 September 2026. The school will operate from 8:00 AM to 2:00 PM on all working days.\n\nTransport timings have been adjusted accordingly and updated route details will be shared by the transport office. We request parents to plan pick-up and drop-off around the new schedule.",
    category: "Circular",
    publishedAt: "2026-08-15T16:00:00",
  },
  {
    id: "su-holiday",
    school: "Greenfield Public School",
    title: "Holiday Notice: Founder's Day",
    preview: "The school will remain closed on 29 August 2026 on account of Founder's Day.",
    content:
      "This is to inform all parents that the school will remain closed on 29 August 2026 in observance of Founder's Day. Regular classes will resume the following working day.\n\nWishing all our families a restful break.",
    category: "Holiday",
    publishedAt: "2026-08-10T10:45:00",
  },
  // Unrelated school — used to verify school-scoped filtering. The demo parent must NOT see this.
  {
    id: "su-other-school",
    school: "St. Mary's Convent School",
    title: "Admission Open House",
    preview: "St. Mary's Convent invites families to its admissions open house.",
    content:
      "St. Mary's Convent School will host an admissions open house on 5 September 2026. This notice is intended for St. Mary's families only.",
    category: "Announcement",
    publishedAt: "2026-08-21T12:00:00",
  },
]

function pad(value: number) {
  return String(value).padStart(2, "0")
}

/** Formats an ISO datetime as DD/MM/YYYY. */
export function formatUpdateDate(iso: string) {
  const date = new Date(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Formats an ISO datetime as a display time, e.g. "9:30 AM". */
export function formatUpdateTime(iso: string) {
  const date = new Date(iso)
  const hour = date.getHours()
  const minute = date.getMinutes()
  const suffix = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return `${hour12}:${pad(minute)} ${suffix}`
}

/**
 * Returns the updates published by any of the given schools, sorted newest-first by the notice's
 * actual publish time. Passing the set of schools the parent's children attend scopes the feed so
 * unrelated schools' notices never appear.
 */
export function updatesForSchools(updates: SchoolUpdate[], schools: string[]): SchoolUpdate[] {
  const allowed = new Set(schools)
  return updates
    .filter((update) => allowed.has(update.school))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
