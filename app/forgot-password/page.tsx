import { AuthLayout } from '@/components/auth/auth-layout'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      headline={
        <>
          Reset it in <br />
          <span className="text-brand">seconds.</span> Back on track.
        </>
      }
      description="Forgot your password? No worries. Enter your email and we'll send you a secure link to get you back into your Aspira account."
      footerNote="Secure. Reliable. Built for Education & Growth."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  )
}
