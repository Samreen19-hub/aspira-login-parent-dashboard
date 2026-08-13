'use client'

import * as React from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/auth/form-field'

interface PasswordFieldProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  id: string
  label: string
  error?: string
}

/** Password input with a show/hide toggle, reused across login & signup. */
export function PasswordField({ id, label, error, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <FormField
      id={id}
      label={label}
      icon={Lock}
      type={visible ? 'text' : 'password'}
      error={error}
      autoComplete="current-password"
      endAdornment={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      }
      {...props}
    />
  )
}
