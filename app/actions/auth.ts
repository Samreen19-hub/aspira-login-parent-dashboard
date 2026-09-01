'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profiles, user } from '@/lib/db/schema'
import type { Persona } from '@/lib/personas'
import { PERSONAS } from '@/lib/personas'

/** Shape consumed by the client AuthProvider / useAuth() UI contract. */
export interface AspiraUser {
  id: string
  name: string
  email: string
  phone?: string
  persona: Persona
  avatar?: string
}

const VALID_PERSONAS = Object.keys(PERSONAS) as Persona[]

function coercePersona(value: string | null | undefined): Persona {
  return value && (VALID_PERSONAS as string[]).includes(value)
    ? (value as Persona)
    : 'parent'
}

/** Turn a name/email into a URL-safe, reasonably unique profile slug. */
function makeSlug(base: string): string {
  const root =
    base
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'user'
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${root}-${suffix}`
}

/**
 * Read the current Better Auth session and merge it with the app profile row.
 * Returns null when there is no active session.
 */
export async function getSessionUser(): Promise<AspiraUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1)

  return {
    id: session.user.id,
    name: profile?.name ?? session.user.name,
    email: session.user.email,
    phone: profile?.phone ?? undefined,
    persona: coercePersona(profile?.persona),
    avatar: profile?.avatar ?? session.user.image ?? undefined,
  }
}

/**
 * Ensure a profile row exists for the currently signed-in user. Called right
 * after sign-up so the persona/phone chosen in the form are persisted.
 */
export async function ensureProfile(input: {
  name: string
  persona: Persona
  phone?: string
}): Promise<AspiraUser> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Not authenticated.')

  const userId = session.user.id
  const persona = coercePersona(input.persona)

  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1)

  if (!existing) {
    await db.insert(profiles).values({
      userId,
      slug: makeSlug(input.name || session.user.email),
      name: input.name?.trim() || session.user.name,
      persona,
      phone: input.phone?.trim() || null,
    })
  }

  const result = await getSessionUser()
  if (!result) throw new Error('Failed to load profile.')
  return result
}

/**
 * Password-reset request stub. No email provider is configured, so this always
 * resolves — the UI shows a generic "check your inbox" confirmation regardless
 * of whether the address exists (avoids account enumeration).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!email?.trim()) throw new Error('Please enter your email address.')
  // Intentionally no-op: wire up a real email provider to enable resets.
}
