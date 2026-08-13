import { AuthLayout } from '@/components/auth/auth-layout'
import { SignupForm } from '@/components/auth/signup-form'

export default function SignupPage() {
  return (
    <AuthLayout
      headline={
        <>
          Join Aspira Today. <br />
          Shape Tomorrow <span className="text-brand">Together.</span>
        </>
      }
      description="Create your account and become part of a trusted platform that connects students, parents, educational institutions, schools and companies for a better future."
      footerNote="Your data is safe with us. We value your privacy."
    >
      <SignupForm persona="parent" />
    </AuthLayout>
  )
}
