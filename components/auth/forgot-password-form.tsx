'use client'

import * as React from 'react'
import Link from 'next/link'
import { Mail, Loader2, AlertCircle, MailCheck, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/auth/form-field'
import { useAuth } from '@/lib/auth-context'
import { isValidEmail } from '@/lib/validation'

export function ForgotPasswordForm() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) return setError('Email address is required.')
    if (!isValidEmail(email)) return setError('Enter a valid email address.')
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-muted text-brand">
          <MailCheck className="size-8" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-foreground">Check your inbox</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          We&apos;ve sent a password reset link to{' '}
          <span className="font-medium text-foreground">{email}</span>. Follow the link to set a new
          password.
        </p>
        <div className="mt-6 grid gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
          >
            Use a different email
          </Button>
          <Button
            render={<Link href="/login" />}
            className="h-12 rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
          >
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="mb-7 text-center">
        <h2 className="font-display text-3xl font-bold text-foreground">Forgot Password?</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Enter the email linked to your account and we&apos;ll send you a link to reset your
          password.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <FormField
          id="reset-email"
          label="Email Address"
          icon={Mail}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
        >
          {submitting ? <Loader2 className="size-5 animate-spin" /> : 'Send Reset Link'}
        </Button>
      </form>

      <Link
        href="/login"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-brand hover:underline"
      >
        <ArrowLeft className="size-4" />
        Back to Login
      </Link>
    </div>
  )
}
