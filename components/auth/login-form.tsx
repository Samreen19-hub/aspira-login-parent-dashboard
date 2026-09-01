'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/auth/form-field'
import { PasswordField } from '@/components/auth/password-field'
import { RoleSelect } from '@/components/auth/role-select'
import { GoogleButton } from '@/components/auth/google-button'
import { useAuth } from '@/lib/auth-context'
import { getPersona, type Persona } from '@/lib/personas'
import { isValidEmail } from '@/lib/validation'

interface LoginFormProps {
  /** Persona this instance is configured for. Preselected but changeable. */
  persona: Persona
}

export function LoginForm({ persona }: LoginFormProps) {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [role, setRole] = React.useState<Persona | null>(persona)
  const [remember, setRemember] = React.useState(true)

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  function validate() {
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = 'Email address is required.'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    if (!role) next.role = 'Please select your role.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const user = await login(email, password, role as Persona)
      router.push(getPersona(user.persona).homeRoute)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to sign in.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <header className="mb-7 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground">Welcome back!</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue to Aspira</p>
      </header>

      {formError && (
        <div
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <FormField
          id="login-email"
          label="Email Address"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <PasswordField
          id="login-password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <RoleSelect
          id="login-role"
          label="Sign in as"
          value={role}
          onChange={setRole}
          error={errors.role}
        />

        <div className="flex items-center justify-between">
          <Label htmlFor="remember" className="cursor-pointer font-normal text-muted-foreground">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(!!v)}
            />
            Remember Me
          </Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-brand hover:underline"
          >
            Forgot Password?
          </Link>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
        >
          {submitting ? <Loader2 className="size-5 animate-spin" /> : 'Sign In'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton onClick={() => router.push(getPersona(persona).homeRoute)} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-semibold text-brand hover:underline">
          Create Account
        </Link>
      </p>
    </div>
  )
}
