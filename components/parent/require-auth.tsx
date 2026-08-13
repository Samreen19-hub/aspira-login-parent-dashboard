'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { AspiraMark } from '@/components/brand/aspira-logo'

/** Client-side guard: only signed-in users reach the dashboard. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isReady } = useAuth()

  useEffect(() => {
    if (isReady && !user) router.replace('/login')
  }, [isReady, user, router])

  if (!isReady || !user) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-lavender">
        <AspiraMark size={44} />
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    )
  }

  return <>{children}</>
}
