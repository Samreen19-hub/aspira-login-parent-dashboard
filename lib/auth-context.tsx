'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Persona } from '@/lib/personas'
import { authClient } from '@/lib/auth-client'
import {
  ensureProfile,
  getSessionUser,
  requestPasswordReset as requestPasswordResetAction,
  type AspiraUser,
} from '@/app/actions/auth'

/**
 * Real authentication backed by Better Auth + Neon.
 *
 * The exported interface is intentionally identical to the previous mock so no
 * UI changes are required: sign-in/sign-up run through the Better Auth client,
 * and the resulting session is merged with the app `profiles` row server-side.
 */
export type { AspiraUser }

interface SignupInput {
  name: string
  email: string
  phone?: string
  password: string
  persona: Persona
}

interface AuthContextValue {
  user: AspiraUser | null
  isReady: boolean
  login: (email: string, password: string, persona: Persona) => Promise<AspiraUser>
  signup: (input: SignupInput) => Promise<AspiraUser>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Normalize Better Auth client errors into a friendly, generic message. */
function authErrorMessage(error: { message?: string } | null, fallback: string) {
  if (!error) return fallback
  return error.message || fallback
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AspiraUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Hydrate the session on mount from the server (source of truth = cookie).
  useEffect(() => {
    let active = true
    getSessionUser()
      .then((next) => {
        if (active) setUser(next)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setIsReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback<AuthContextValue['login']>(async (email, password) => {
    // Persona from the selector is cosmetic — we trust the stored profile.
    const { error } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      throw new Error(
        authErrorMessage(error, 'Incorrect email or password. Please try again.'),
      )
    }
    const next = await getSessionUser()
    if (!next) throw new Error('Unable to sign in. Please try again.')
    setUser(next)
    return next
  }, [])

  const signup = useCallback<AuthContextValue['signup']>(
    async ({ name, email, phone, password, persona }) => {
      const { error } = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
      })
      if (error) {
        throw new Error(authErrorMessage(error, 'Unable to create account.'))
      }
      const next = await ensureProfile({ name, persona, phone })
      setUser(next)
      return next
    },
    [],
  )

  const logout = useCallback(() => {
    setUser(null)
    void authClient.signOut()
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    await requestPasswordResetAction(email)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, login, signup, logout, requestPasswordReset }),
    [user, isReady, login, signup, logout, requestPasswordReset],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
