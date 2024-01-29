import React from 'react'
import { Tooltip as RadixTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/shadcn/ui/tooltip'

export function Tooltip({ content, children, delayDuration }: { 
  children: ((props: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.ReactNode) | React.ReactNode
  content: React.ReactNode
  delayDuration?: number
}) {
  const [longpressTimeout, setLongpressTimeout] = React.useState<NodeJS.Timeout | undefined>()
  const [visible, setVisible] = React.useState(false)

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setLongpressTimeout(setTimeout(() => {
      setVisible(true)
    }, delayDuration || 500))
  }

  const handleTouchEnd = () => {
    clearTimeout(longpressTimeout)
    setLongpressTimeout(undefined)
  }

  const events = {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  }

  return (
    <TooltipProvider>
      <RadixTooltip open={visible} delayDuration={delayDuration ?? 0} onOpenChange={setVisible}>
        <TooltipTrigger asChild>
          {typeof children !== 'function' ? (
            <button onClick={e => e.stopPropagation()} {...events}>
              {children}
            </button>
          ) : children(events)}
        </TooltipTrigger>
        <TooltipContent className='bg-muted select-none'>
          {content}
        </TooltipContent>
      </RadixTooltip>
    </TooltipProvider>
  )
}