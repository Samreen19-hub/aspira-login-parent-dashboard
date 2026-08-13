'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FieldShellProps {
  id: string
  label: string
  error?: string
  optional?: boolean
  children: React.ReactNode
  className?: string
}

/** Label + error wrapper shared by every auth input. */
export function FieldShell({ id, label, error, optional, children, className }: FieldShellProps) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id} className="text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground">(Optional)</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

interface FormFieldProps extends React.ComponentProps<'input'> {
  id: string
  label: string
  icon?: LucideIcon
  error?: string
  optional?: boolean
  endAdornment?: React.ReactNode
}

/** Standard labelled text input with a leading icon. */
export function FormField({
  id,
  label,
  icon: Icon,
  error,
  optional,
  endAdornment,
  className,
  ...props
}: FormFieldProps) {
  return (
    <FieldShell id={id} label={label} error={error} optional={optional}>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'h-12 rounded-xl text-sm',
            Icon && 'pl-10',
            endAdornment && 'pr-11',
            className,
          )}
          {...props}
        />
        {endAdornment && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2">{endAdornment}</div>
        )}
      </div>
    </FieldShell>
  )
}
