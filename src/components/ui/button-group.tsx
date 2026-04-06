import * as React from 'react'
import { cn } from '../../lib/utils'

interface ButtonGroupOption<T extends string> {
  value: T
  label: string
}

interface ButtonGroupProps<T extends string> {
  options: ButtonGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function ButtonGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: ButtonGroupProps<T>) {
  return (
    <div className={cn('inline-flex rounded-md shadow-sm', className)}>
      {options.map((opt, i) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:z-10',
              i === 0 && 'rounded-l-md',
              i === options.length - 1 && 'rounded-r-md',
              i > 0 && '-ml-px',
              active
                ? 'bg-primary text-primary-foreground border-primary z-10'
                : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
