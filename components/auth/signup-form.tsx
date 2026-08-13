'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Mail, Phone, Loader2, AlertCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FormField } from '@/components/auth/form-field'
import { PasswordField } from '@/components/auth/password-field'
import { RoleCards } from '@/components/auth/role-cards'
import { GoogleButton } from '@/components/auth/google-button'
import { AuthStepper } from '@/components/auth/auth-stepper'
import { useAuth } from '@/lib/auth-context'
import { getPersona, type Persona } from '@/lib/personas'
import { isValidEmail, isValidPhone, passwordIssue } from '@/lib/validation'

interface SignupFormProps {
  /** Persona this instance is configured for. Preselected in the card picker. */
  persona: Persona
}

export function SignupForm({ persona }: SignupFormProps) {
  const router = useRouter()
  const { signup } = useAuth()

  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [role, setRole] = React.useState<Persona | null>(persona)
  const [agree, setAgree] = React.useState(false)

  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  function validate() {
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Full name is required.'
    if (phone && !isValidPhone(phone)) next.phone = 'Enter a valid mobile number.'
    if (!email.trim()) next.email = 'Email address is required.'
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address.'
    const pwIssue = passwordIssue(password)
    if (!password) next.password = 'Password is required.'
    else if (pwIssue) next.password = pwIssue
    if (!confirm) next.confirm = 'Please confirm your password.'
    else if (confirm !== password) next.confirm = 'Passwords do not match.'
    if (!role) next.role = 'Please select a role.'
    if (!agree) next.agree = 'Please accept the Terms of Service to continue.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const user = await signup({
        name,
        email,
        phone: phone || undefined,
        password,
        persona: role as Persona,
      })
      router.push(getPersona(user.persona).homeRoute)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create account.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <header className="mb-5 text-center">
        <h2 className="flex items-center justify-center gap-1.5 font-display text-3xl font-bold text-foreground">
          Create your account
          <Sparkles className="size-6 text-brand" />
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Start your journey with Aspira</p>
      </header>

      <AuthStepper className="mb-6" />

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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="signup-name"
            label="Full Name"
            icon={User}
            autoComplete="name"
            placeholder="Enter your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <FormField
            id="signup-phone"
            label="Phone Number"
            optional
            icon={Phone}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Enter your number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
        </div>

        <FormField
          id="signup-email"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordField
            id="signup-password"
            label="Password"
            placeholder="Create a strong password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <PasswordField
            id="signup-confirm"
            label="Confirm Password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
        </div>

        <RoleCards label="I am signing up as" value={role} onChange={setRole} error={errors.role} />

        <div className="grid gap-1">
          <Label htmlFor="agree" className="cursor-pointer items-start font-normal text-muted-foreground">
            <Checkbox
              id="agree"
              checked={agree}
              onCheckedChange={(v) => setAgree(!!v)}
              className="mt-0.5"
            />
            <span>
              I agree to Aspira&apos;s{' '}
              <span className="font-medium text-brand">Terms of Service</span> and{' '}
              <span className="font-medium text-brand">Privacy Policy</span>
            </span>
          </Label>
          {errors.agree && (
            <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {errors.agree}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
        >
          {submitting ? <Loader2 className="size-5 animate-spin" /> : 'Create Account'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton onClick={() => router.push(getPersona(persona).homeRoute)} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  )
}
