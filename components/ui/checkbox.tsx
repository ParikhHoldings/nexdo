'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, checked, onChange, ...props }, ref) => {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer group">
        <div className="relative">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              'h-5 w-5 rounded border-2 transition-all duration-200',
              'border-zinc-600 bg-transparent',
              'group-hover:border-zinc-500',
              'peer-checked:bg-accent peer-checked:border-accent',
              'peer-focus:ring-2 peer-focus:ring-accent/50 peer-focus:ring-offset-2 peer-focus:ring-offset-zinc-950',
              className
            )}
          >
            <Check
              className={cn(
                'h-3 w-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                'transition-all duration-200',
                checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              )}
              strokeWidth={3}
            />
          </div>
        </div>
        {label && (
          <span className="text-sm text-zinc-300 select-none">{label}</span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export { Checkbox }
