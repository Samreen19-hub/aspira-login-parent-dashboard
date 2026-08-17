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

/**
 * Shared, front-end-only mock authentication.
 *
 * There is intentionally no backend here — the session is kept in React state and
 * mirrored to localStorage so a refresh keeps you signed in during the prototype.
 * Replacing this provider with a real service later requires no UI changes.
 */
export interface AspiraUser {
  id: string
  name: string
  email: string
  phone?: string
  persona: Persona
  avatar?: string
}

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

const STORAGE_KEY = 'aspira.session'

/** A demo account so reviewers can sign in without creating one first. */
const DEMO_ACCOUNTS: Record<
  string,
  { password: string; user: Omit<AspiraUser, 'persona'> }
> = {
  'parent@aspira.com': {
    password: 'password123',
    user: {
      id: 'usr_rashi',
      name: 'Rashi Kapoor',
      email: 'parent@aspira.com',
      phone: '+91 98765 43210',
      avatar: '/avatar-rashi.png',
    },
  },
}

const AuthContext = createContext<AuthContextValue | null>(null)

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AspiraUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AspiraUser>
        if (parsed.id && parsed.name && parsed.email && parsed.persona) setUser(parsed as AspiraUser)
        else window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
    setIsReady(true)
  }, [])

  const persist = useCallback((next: AspiraUser | null) => {
    setUser(next)
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const login = useCallback<AuthContextValue['login']>(
    async (email, password, persona) => {
      await delay(650)
      const normalized = email.trim().toLowerCase()
      const account = DEMO_ACCOUNTS[normalized]

      // For the prototype we accept the seeded demo account with its password,
      // and also accept any other email as long as a password is provided.
      if (account && account.password !== password) {
        throw new Error('Incorrect email or password. Please try again.')
      }
      if (!account && password.length < 6) {
        throw new Error('Incorrect email or password. Please try again.')
      }

      const nextUser: AspiraUser = account
        ? { ...account.user, persona }
        : {
            id: `usr_${normalized.split('@')[0] || 'aspira'}`,
            name: normalized
              .split('@')[0]
              .replace(/[._]/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            email: normalized,
            persona,
            avatar: '/avatar-rashi.png',
          }
      persist(nextUser)
      return nextUser
    },
    [persist],
  )

  const signup = useCallback<AuthContextValue['signup']>(
    async ({ name, email, phone, password, persona }) => {
      await delay(750)
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.')
      }
      const nextUser: AspiraUser = {
        id: `usr_${email.trim().toLowerCase().split('@')[0]}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone,
        persona,
        avatar: '/avatar-rashi.png',
      }
      persist(nextUser)
      return nextUser
    },
    [persist],
  )

  const logout = useCallback(() => persist(null), [persist])

  const requestPasswordReset = useCallback(async (email: string) => {
    await delay(700)
    if (!email) throw new Error('Please enter your email address.')
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
