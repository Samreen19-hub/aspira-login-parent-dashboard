import { AuthLayout } from '@/components/auth/auth-layout'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <AuthLayout
      headline={
        <>
          One Platform. <br />
          <span className="text-brand">Endless</span> Possibilities.
        </>
      }
      description="Aspira connects students, parents, educational institutions, schools and companies to collaborate, communicate and create opportunities for a better future."
      footerNote="Secure. Reliable. Built for Education & Growth."
    >
      <LoginForm persona="parent" />
    </AuthLayout>
  )
}
