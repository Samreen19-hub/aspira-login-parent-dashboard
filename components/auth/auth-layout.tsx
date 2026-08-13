import Image from 'next/image'
import { ShieldCheck, GraduationCap, UsersRound, Landmark, Briefcase } from 'lucide-react'
import { AspiraLogo } from '@/components/brand/aspira-logo'

interface AuthLayoutProps {
  /** Left-panel headline. Use <span className="text-brand"> to highlight a word. */
  headline: React.ReactNode
  description: string
  footerNote: string
  children: React.ReactNode
}

const ORBIT = [
  { icon: GraduationCap, className: 'left-2 top-24' },
  { icon: UsersRound, className: 'left-0 bottom-28' },
  { icon: Landmark, className: 'right-6 top-20' },
  { icon: Briefcase, className: 'right-2 bottom-32' },
]

export function AuthLayout({ headline, description, footerNote, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-svh w-full bg-lavender p-3 sm:p-5 lg:p-6">
      <div className="mx-auto flex w-full max-w-6xl overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-foreground/5">
        {/* Brand panel */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-b from-brand-muted via-lavender to-brand-muted p-8 lg:flex xl:p-10">
          <AspiraLogo />

          <div className="relative z-10">
            <h1 className="font-display text-3xl font-extrabold leading-tight text-foreground text-balance xl:text-[2.6rem]">
              {headline}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-center py-4">
            <div className="relative w-full max-w-md">
              {ORBIT.map(({ icon: Icon, className }, i) => (
                <span
                  key={i}
                  className={`absolute z-20 hidden size-11 items-center justify-center rounded-full bg-card text-brand shadow-md ring-1 ring-foreground/5 xl:flex ${className}`}
                >
                  <Icon className="size-5" />
                </span>
              ))}
              <Image
                src="/aspira-illustration.png"
                alt="Students, parents and professionals collaborating on the Aspira platform"
                width={640}
                height={520}
                priority
                className="h-auto w-full object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2.5 rounded-xl bg-card/70 px-4 py-3 text-sm font-medium text-brand ring-1 ring-brand/10 backdrop-blur">
            <ShieldCheck className="size-5 shrink-0" />
            {footerNote}
          </div>
        </section>

        {/* Form panel */}
        <section className="flex w-full flex-col overflow-y-auto p-6 sm:p-10 lg:w-1/2 xl:p-14">
          <div className="mb-8 lg:hidden">
            <AspiraLogo />
          </div>
          <div className="m-auto w-full max-w-md">{children}</div>
        </section>
      </div>
    </main>
  )
}
