import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>): React.JSX.Element {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-[22px] w-10 shrink-0 items-center rounded-full border border-transparent shadow-[var(--shadow-xs)] transition-all duration-200 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-[18px] rounded-full bg-background shadow-sm ring-0 transition-transform duration-200 [transition-timing-function:var(--ease-spring)] data-[state=checked]:translate-x-[19px] data-[state=unchecked]:translate-x-[1px]'
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
