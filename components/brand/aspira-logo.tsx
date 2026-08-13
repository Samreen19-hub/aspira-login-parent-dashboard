import { cn } from '@/lib/utils'

interface AspiraLogoProps {
  className?: string
  showTagline?: boolean
  /** size of the mark in pixels */
  size?: number
}

export function AspiraMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="aspira-a" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d28d9" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="aspira-b" x1="20" y1="42" x2="34" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
      </defs>
      <path d="M22.2 5.5 4 42h9.6l10.7-22.6L35 42h9.6L26.4 5.5a2.4 2.4 0 0 0-4.2 0Z" fill="url(#aspira-a)" />
      <path d="M24.3 19.4 18 32.6h12.6L24.3 19.4Z" fill="url(#aspira-b)" />
    </svg>
  )
}

export function AspiraLogo({ className, showTagline = true, size = 36 }: AspiraLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <AspiraMark size={size} />
      <div className="flex flex-col leading-none">
        <span className="font-display text-2xl font-extrabold tracking-tight text-brand">
          aspira
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.18em] text-muted-foreground">
            Connect · Learn · Grow
          </span>
        )}
      </div>
    </div>
  )
}
