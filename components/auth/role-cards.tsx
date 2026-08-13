'use client'

import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { PERSONA_LIST, type Persona } from '@/lib/personas'
import { cn } from '@/lib/utils'

interface RoleCardsProps {
  label: string
  value: Persona | null
  onChange: (persona: Persona) => void
  error?: string
}

/** Card-based persona picker used on the Sign Up screen ("I am signing up as"). */
export function RoleCards({ label, value, onChange, error }: RoleCardsProps) {
  return (
    <div className="grid gap-2">
      <Label className="text-foreground">{label}</Label>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {PERSONA_LIST.map((persona) => {
          const Icon = persona.icon
          const active = value === persona.id
          return (
            <button
              key={persona.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(persona.id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all outline-none',
                'focus-visible:ring-3 focus-visible:ring-ring/40',
                active
                  ? 'border-brand bg-brand-muted shadow-sm ring-1 ring-brand/30'
                  : 'border-border bg-card hover:border-brand/40 hover:bg-accent/50',
              )}
            >
              <Icon className={cn('size-6', persona.accent)} />
              <span className="text-xs font-medium leading-tight text-foreground">
                {persona.label}
              </span>
            </button>
          )
        })}
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
