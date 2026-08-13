import { cn } from '@/lib/utils'

const STEPS = ['Account Details', 'Verify Email', "You're All Set"]

interface AuthStepperProps {
  current?: number
  className?: string
}

export function AuthStepper({ current = 0, className }: AuthStepperProps) {
  return (
    <div className={cn('flex items-center', className)}>
      {STEPS.map((step, i) => {
        const active = i <= current
        return (
          <div key={step} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  active
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] font-medium',
                  i === current ? 'text-brand' : 'text-muted-foreground',
                )}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  '-mt-5 h-0.5 flex-1',
                  i < current ? 'bg-brand' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
