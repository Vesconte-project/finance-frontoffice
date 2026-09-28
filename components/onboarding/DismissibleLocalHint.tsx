'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type DismissibleLocalHintProps = {
  storageKey: string
  text: string
  className?: string
}

export default function DismissibleLocalHint({
  storageKey,
  text,
  className,
}: DismissibleLocalHintProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const dismissed = window.localStorage.getItem(storageKey) === '1'
        setVisible(!dismissed)
      } catch {
        setVisible(true)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [storageKey])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-content-secondary',
        className
      )}
      role="status"
    >
      <p className="font-medium">{text}</p>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-[12px] text-content-muted transition-[background-color,color,border-color,box-shadow] duration-150 hover:bg-surface-hover hover:text-content-primary active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
        onClick={() => {
          setVisible(false)
          try {
            window.localStorage.setItem(storageKey, '1')
          } catch {
            // Ignore storage failures.
          }
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
