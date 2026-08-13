'use client'

import { ChevronDown, UsersRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FieldShell } from '@/components/auth/form-field'
import { PERSONA_LIST, type Persona, getPersona } from '@/lib/personas'
import { cn } from '@/lib/utils'

interface RoleSelectProps {
  id: string
  label: string
  value: Persona | null
  onChange: (persona: Persona) => void
  error?: string
}

/** Dropdown persona picker used on the Login screen ("Sign in as"). */
export function RoleSelect({ id, label, value, onChange, error }: RoleSelectProps) {
  const selected = value ? getPersona(value) : null
  const SelectedIcon = selected?.icon ?? UsersRound

  return (
    <FieldShell id={id} label={label} error={error}>
      <DropdownMenu>
        <DropdownMenuTrigger
          id={id}
          aria-invalid={!!error}
          className={cn(
            'flex h-12 w-full items-center gap-2.5 rounded-xl border border-input bg-transparent px-3 text-sm outline-none transition-colors',
            'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'aria-expanded:border-ring aria-invalid:border-destructive',
          )}
        >
          <SelectedIcon className={cn('size-4 shrink-0', selected ? selected.accent : 'text-muted-foreground')} />
          <span className={cn('flex-1 text-left', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : 'Select your role'}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-(--anchor-width) p-1.5">
          {PERSONA_LIST.map((persona) => {
            const Icon = persona.icon
            return (
              <DropdownMenuItem
                key={persona.id}
                onClick={() => onChange(persona.id)}
                className="gap-2.5 rounded-lg py-2.5"
              >
                <Icon className={cn('size-4', persona.accent)} />
                <span className="font-medium">{persona.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </FieldShell>
  )
}
