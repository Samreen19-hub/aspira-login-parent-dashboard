import {
  GraduationCap,
  UsersRound,
  Landmark,
  School,
  Briefcase,
  type LucideIcon,
} from 'lucide-react'

/**
 * Aspira supports multiple personas. The authentication system is built once and
 * configured per-persona so the same Login / Sign Up / Forgot Password UI can be
 * reused across every dashboard once the platform is merged.
 */
export type Persona = 'student' | 'parent' | 'university' | 'school' | 'company'

export interface PersonaConfig {
  /** Stable value stored in the auth session (e.g. "parent"). */
  id: Persona
  /** Human readable label shown in the UI. */
  label: string
  description: string
  icon: LucideIcon
  /** Tailwind classes for the icon accent used in role selectors. */
  accent: string
  /** Route the persona lands on after a successful authentication. */
  homeRoute: string
}

export const PERSONAS: Record<Persona, PersonaConfig> = {
  student: {
    id: 'student',
    label: 'Student',
    description: 'Learn, connect and grow',
    icon: GraduationCap,
    accent: 'text-brand',
    homeRoute: '/student',
  },
  parent: {
    id: 'parent',
    label: 'Parent',
    description: "Follow your child's journey",
    icon: UsersRound,
    accent: 'text-rose-500',
    homeRoute: '/parent',
  },
  university: {
    id: 'university',
    label: 'Educational Institution',
    description: 'Manage programs and admissions',
    icon: Landmark,
    accent: 'text-blue-600',
    homeRoute: '/university',
  },
  school: {
    id: 'school',
    label: 'School',
    description: 'Engage students and parents',
    icon: School,
    accent: 'text-orange-500',
    homeRoute: '/school',
  },
  company: {
    id: 'company',
    label: 'Company',
    description: 'Hire and mentor talent',
    icon: Briefcase,
    accent: 'text-emerald-600',
    homeRoute: '/company',
  },
}

export const PERSONA_LIST: PersonaConfig[] = [
  PERSONAS.student,
  PERSONAS.parent,
  PERSONAS.university,
  PERSONAS.school,
  PERSONAS.company,
]

export function getPersona(id: Persona): PersonaConfig {
  return PERSONAS[id]
}
