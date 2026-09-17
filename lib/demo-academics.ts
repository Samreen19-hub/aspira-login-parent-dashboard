/**
 * DEMO / UI-ONLY academic data (timetable + report cards).
 *
 * This is controlled dummy data used to demonstrate the intended Parent UI for
 * the Timetable and Report Card screens. It is intentionally NOT persisted:
 *  - no database tables, no migrations, no changes to `parent_child`, and
 *  - no coupling to the real School Notifications / feed / events systems.
 *
 * The final architecture will eventually be:
 *   Child → Institution → Academic Year → Class/Year → Section → Timetable
 * and report cards will be published by the School Admin experience. Until that
 * exists, this module models the same shape with fixed sample data so the UI can
 * be built and tested against it.
 *
 * Demo data is matched by CHILD NAME (case-insensitive substring), mirroring the
 * existing demo/test-account scenario "Mujtaba → child Mariyam". Any child whose
 * name does not match a demo key resolves to NO data, so ordinary parents keep
 * seeing the real empty states — dummy data is never shown to every parent.
 */

import { getSubjectMeta, type WeekdayName } from "@/lib/timetable-data"

export type { WeekdayName }

/* -------------------------------------------------------------------------- */
/*  Timetable types                                                            */
/* -------------------------------------------------------------------------- */

export interface DemoClass {
  subject: string
  /** Human-readable start time, e.g. "8:00 AM". */
  start: string
  /** Human-readable end time, e.g. "8:45 AM". */
  end: string
  /** Room or location, e.g. "Room 101". */
  room: string
}

export interface DemoAcademicYear {
  /** Academic-year label, e.g. "2026–27". */
  year: string
  /** Class or year of study, e.g. "Class 8" or "1st Year". */
  level: string
  /** Section, e.g. "A" or "CSE-A". */
  section: string
  /** Weekly class template, keyed by weekday. Days with no classes are omitted. */
  weekly: Partial<Record<WeekdayName, DemoClass[]>>
}

export type DemoInstitutionType = "school" | "university"

export interface DemoInstitution {
  id: string
  type: DemoInstitutionType
  /** Institution name, e.g. "Greenfield Public School" or "ABC University". */
  name: string
  /** Academic years for this institution, most recent first (last 2 supported here). */
  years: DemoAcademicYear[]
}

/* -------------------------------------------------------------------------- */
/*  Report-card types                                                          */
/* -------------------------------------------------------------------------- */

export interface DemoSubjectResult {
  subject: string
  marks: number
  max: number
  grade: string
}

export interface DemoReportCard {
  id: string
  /** Academic-year label, e.g. "2025–26". */
  year: string
  /** School / institution that issued the report card. */
  institution: string
  /** Class / grade for that year, e.g. "Class 7". */
  level: string
  /** Examination/term the report card covers. */
  term: string
  status: "Published" | "Provisional"
  subjects: DemoSubjectResult[]
  /** Class-teacher remarks shown at the foot of the report card. */
  remarks: string
  teacher: string
}

/* -------------------------------------------------------------------------- */
/*  Name matching                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a child's display name to a demo key. Matches case-insensitively on a
 * name substring so "Mariyam" or "Mariyam Khan" both map to the `mariyam` demo.
 * Returns null when the child is not a demo child.
 */
function demoKeyFor(childName: string, keys: string[]): string | null {
  const name = childName.trim().toLowerCase()
  return keys.find((key) => name.includes(key)) ?? null
}

/* -------------------------------------------------------------------------- */
/*  Timetable demo data                                                        */
/* -------------------------------------------------------------------------- */

/** Class 8 weekly template (Mariyam, 2026–27). */
const MARIYAM_CLASS_8: DemoAcademicYear = {
  year: "2026–27",
  level: "Class 8",
  section: "A",
  weekly: {
    Monday: [
      { subject: "Mathematics", start: "8:00 AM", end: "8:45 AM", room: "Room 101" },
      { subject: "English", start: "8:50 AM", end: "9:35 AM", room: "Room 102" },
      { subject: "Science", start: "9:50 AM", end: "10:35 AM", room: "Lab 1" },
      { subject: "History", start: "10:40 AM", end: "11:25 AM", room: "Room 104" },
    ],
    Tuesday: [
      { subject: "Science", start: "8:00 AM", end: "8:45 AM", room: "Lab 1" },
      { subject: "Mathematics", start: "8:50 AM", end: "9:35 AM", room: "Room 101" },
      { subject: "Geography", start: "9:50 AM", end: "10:35 AM", room: "Room 105" },
      { subject: "Art", start: "10:40 AM", end: "11:25 AM", room: "Art Room" },
    ],
    Wednesday: [
      { subject: "English", start: "8:00 AM", end: "8:45 AM", room: "Room 102" },
      { subject: "Mathematics", start: "8:50 AM", end: "9:35 AM", room: "Room 101" },
      { subject: "Robotics", start: "9:50 AM", end: "10:35 AM", room: "Lab 2" },
      { subject: "Library", start: "10:40 AM", end: "11:25 AM", room: "Library" },
    ],
    Thursday: [
      { subject: "Science", start: "8:00 AM", end: "8:45 AM", room: "Lab 1" },
      { subject: "English", start: "8:50 AM", end: "9:35 AM", room: "Room 102" },
      { subject: "Music", start: "9:50 AM", end: "10:35 AM", room: "Music Room" },
      { subject: "Physical Education", start: "10:40 AM", end: "11:25 AM", room: "Sports Ground" },
    ],
    Friday: [
      { subject: "Mathematics", start: "8:00 AM", end: "8:45 AM", room: "Room 101" },
      { subject: "Geography", start: "8:50 AM", end: "9:35 AM", room: "Room 105" },
      { subject: "Robotics", start: "9:50 AM", end: "10:35 AM", room: "Lab 2" },
      { subject: "Physical Education", start: "10:40 AM", end: "11:25 AM", room: "Sports Ground" },
    ],
  },
}

/** Class 7 weekly template (Mariyam, 2025–26). */
const MARIYAM_CLASS_7: DemoAcademicYear = {
  year: "2025–26",
  level: "Class 7",
  section: "B",
  weekly: {
    Monday: [
      { subject: "English", start: "8:15 AM", end: "9:00 AM", room: "Room 202" },
      { subject: "Mathematics", start: "9:05 AM", end: "9:50 AM", room: "Room 201" },
      { subject: "Science", start: "10:05 AM", end: "10:50 AM", room: "Lab 1" },
      { subject: "Art", start: "10:55 AM", end: "11:40 AM", room: "Art Room" },
    ],
    Tuesday: [
      { subject: "Mathematics", start: "8:15 AM", end: "9:00 AM", room: "Room 201" },
      { subject: "Geography", start: "9:05 AM", end: "9:50 AM", room: "Room 205" },
      { subject: "English", start: "10:05 AM", end: "10:50 AM", room: "Room 202" },
      { subject: "Music", start: "10:55 AM", end: "11:40 AM", room: "Music Room" },
    ],
    Wednesday: [
      { subject: "Science", start: "8:15 AM", end: "9:00 AM", room: "Lab 1" },
      { subject: "Mathematics", start: "9:05 AM", end: "9:50 AM", room: "Room 201" },
      { subject: "History", start: "10:05 AM", end: "10:50 AM", room: "Room 204" },
      { subject: "Library", start: "10:55 AM", end: "11:40 AM", room: "Library" },
    ],
    Thursday: [
      { subject: "English", start: "8:15 AM", end: "9:00 AM", room: "Room 202" },
      { subject: "Science", start: "9:05 AM", end: "9:50 AM", room: "Lab 1" },
      { subject: "Mathematics", start: "10:05 AM", end: "10:50 AM", room: "Room 201" },
      { subject: "Physical Education", start: "10:55 AM", end: "11:40 AM", room: "Sports Ground" },
    ],
    Friday: [
      { subject: "Geography", start: "8:15 AM", end: "9:00 AM", room: "Room 205" },
      { subject: "English", start: "9:05 AM", end: "9:50 AM", room: "Room 202" },
      { subject: "Art", start: "10:05 AM", end: "10:50 AM", room: "Art Room" },
      { subject: "Physical Education", start: "10:55 AM", end: "11:40 AM", room: "Sports Ground" },
    ],
  },
}

/** University 1st Year weekly template (Mariyam demo, 2026–27). */
const MARIYAM_UNI_YEAR_1: DemoAcademicYear = {
  year: "2026–27",
  level: "1st Year",
  section: "CSE-A",
  weekly: {
    Monday: [
      { subject: "Mathematics", start: "9:00 AM", end: "10:30 AM", room: "Hall 1" },
      { subject: "English", start: "10:45 AM", end: "12:15 PM", room: "Hall 2" },
    ],
    Tuesday: [
      { subject: "Science", start: "9:00 AM", end: "10:30 AM", room: "Physics Lab" },
      { subject: "Robotics", start: "10:45 AM", end: "12:15 PM", room: "Computer Lab" },
    ],
    Wednesday: [
      { subject: "Mathematics", start: "9:00 AM", end: "10:30 AM", room: "Hall 1" },
      { subject: "Library", start: "10:45 AM", end: "12:15 PM", room: "Central Library" },
    ],
    Thursday: [
      { subject: "Science", start: "9:00 AM", end: "10:30 AM", room: "Physics Lab" },
      { subject: "Robotics", start: "10:45 AM", end: "12:15 PM", room: "Computer Lab" },
    ],
    Friday: [
      { subject: "English", start: "9:00 AM", end: "10:30 AM", room: "Hall 2" },
      { subject: "Physical Education", start: "10:45 AM", end: "12:15 PM", room: "Sports Complex" },
    ],
  },
}

/** University Foundation weekly template (Mariyam demo, 2025–26). */
const MARIYAM_UNI_FOUNDATION: DemoAcademicYear = {
  year: "2025–26",
  level: "Foundation Year",
  section: "CSE-A",
  weekly: {
    Monday: [
      { subject: "English", start: "9:30 AM", end: "11:00 AM", room: "Hall 3" },
      { subject: "Mathematics", start: "11:15 AM", end: "12:45 PM", room: "Hall 1" },
    ],
    Tuesday: [
      { subject: "Robotics", start: "9:30 AM", end: "11:00 AM", room: "Computer Lab" },
      { subject: "Science", start: "11:15 AM", end: "12:45 PM", room: "Physics Lab" },
    ],
    Wednesday: [
      { subject: "Mathematics", start: "9:30 AM", end: "11:00 AM", room: "Hall 1" },
      { subject: "English", start: "11:15 AM", end: "12:45 PM", room: "Hall 3" },
    ],
    Thursday: [
      { subject: "Science", start: "9:30 AM", end: "11:00 AM", room: "Physics Lab" },
      { subject: "Library", start: "11:15 AM", end: "12:45 PM", room: "Central Library" },
    ],
    Friday: [
      { subject: "Robotics", start: "9:30 AM", end: "11:00 AM", room: "Computer Lab" },
      { subject: "Mathematics", start: "11:15 AM", end: "12:45 PM", room: "Hall 1" },
    ],
  },
}

/**
 * Demo institutions per child (keyed by name). Mariyam intentionally has BOTH a
 * school and a university institution so the multi-institution UI can be shown:
 * each institution renders its own labelled timetable context. This is
 * illustrative demo data only.
 */
const TIMETABLE_DEMO: Record<string, DemoInstitution[]> = {
  mariyam: [
    {
      id: "school",
      type: "school",
      name: "Greenfield Public School",
      years: [MARIYAM_CLASS_8, MARIYAM_CLASS_7],
    },
    {
      id: "university",
      type: "university",
      name: "ABC University",
      years: [MARIYAM_UNI_YEAR_1, MARIYAM_UNI_FOUNDATION],
    },
  ],
}

/**
 * Institutions (with timetables) for a child, or an empty array when the child
 * is not a demo child (drives the timetable empty state).
 */
export function getDemoInstitutions(childName: string): DemoInstitution[] {
  const key = demoKeyFor(childName, Object.keys(TIMETABLE_DEMO))
  return key ? TIMETABLE_DEMO[key] : []
}

/* -------------------------------------------------------------------------- */
/*  Report-card demo data                                                      */
/* -------------------------------------------------------------------------- */

const REPORT_CARDS_DEMO: Record<string, DemoReportCard[]> = {
  mariyam: [
    {
      id: "rc-2025-26",
      year: "2025–26",
      institution: "Greenfield Public School",
      level: "Class 7",
      term: "Annual Examination",
      status: "Published",
      subjects: [
        { subject: "Mathematics", marks: 92, max: 100, grade: "A1" },
        { subject: "English", marks: 88, max: 100, grade: "A2" },
        { subject: "Science", marks: 90, max: 100, grade: "A1" },
        { subject: "Social Studies", marks: 85, max: 100, grade: "A2" },
        { subject: "Hindi", marks: 82, max: 100, grade: "B1" },
        { subject: "Computer Science", marks: 95, max: 100, grade: "A1" },
      ],
      remarks: "Excellent academic performance and consistent effort throughout the year. Keep it up!",
      teacher: "Ms. Anjali Sharma",
    },
    {
      id: "rc-2024-25",
      year: "2024–25",
      institution: "Greenfield Public School",
      level: "Class 6",
      term: "Annual Examination",
      status: "Published",
      subjects: [
        { subject: "Mathematics", marks: 86, max: 100, grade: "A2" },
        { subject: "English", marks: 84, max: 100, grade: "A2" },
        { subject: "Science", marks: 88, max: 100, grade: "A2" },
        { subject: "Social Studies", marks: 80, max: 100, grade: "B1" },
        { subject: "Hindi", marks: 78, max: 100, grade: "B1" },
        { subject: "Computer Science", marks: 91, max: 100, grade: "A1" },
      ],
      remarks: "A strong year with good progress in Science and Computer Science. Focus on languages next year.",
      teacher: "Mr. Rohit Verma",
    },
  ],
}

/**
 * Report cards for a child (most recent first), or an empty array when the child
 * is not a demo child (drives the report-card empty state). Designed to support
 * up to the last 5 academic years; the demo seeds 2.
 */
export function getDemoReportCards(childName: string): DemoReportCard[] {
  const key = demoKeyFor(childName, Object.keys(REPORT_CARDS_DEMO))
  return key ? REPORT_CARDS_DEMO[key] : []
}

/** Aggregate percentage across a report card's subjects. */
export function reportCardPercentage(card: DemoReportCard): number {
  if (!card.subjects.length) return 0
  const total = card.subjects.reduce((sum, s) => sum + s.marks, 0)
  const max = card.subjects.reduce((sum, s) => sum + s.max, 0)
  return Math.round((total / max) * 1000) / 10
}

/** Overall letter grade derived from the aggregate percentage. */
export function overallGrade(percentage: number): string {
  if (percentage >= 91) return "A1"
  if (percentage >= 81) return "A2"
  if (percentage >= 71) return "B1"
  if (percentage >= 61) return "B2"
  if (percentage >= 51) return "C1"
  return "C2"
}

/** Re-exported so timetable/report cards can share the dashboard subject colours. */
export { getSubjectMeta }
