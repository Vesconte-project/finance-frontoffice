'use client'

import type { ReactNode } from 'react'

/**
 * A button that opens one of the header's expanding menus.
 *
 * Shared by the text triggers (Today, Correlation) and the account avatar so
 * they keep identical pointer, keyboard and focus behaviour.
 */
export default function HeaderMenuTrigger({
  expanded,
  controls,
  onToggle,
  className,
  label,
  children,
}: {
  expanded: boolean
  controls: string
  onToggle: (trigger: HTMLButtonElement, viaKeyboard: boolean) => void
  className?: string
  /** Accessible name, when the visible content is not text. */
  label?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      // Focus lands on mousedown, and focusing the row widens the condensed
      // pill — the trigger shifted out from under the cursor before mouseup,
      // so no click was ever emitted and the menu took two presses.
      // Preventing that mousedown is the fix.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        // `detail` is 0 for keyboard activation, where focus must stay put. A
        // pointer click releases it: suppressing the mousedown focus above
        // makes the browser read any focus landing afterwards as
        // keyboard-driven, so the ring stayed lit on the previous trigger after
        // switching menus — and :focus-within holds the condensed row open
        // once data-menu-open is gone.
        const viaKeyboard = event.detail === 0
        if (viaKeyboard) event.currentTarget.focus()
        else event.currentTarget.blur()
        onToggle(event.currentTarget, viaKeyboard)
      }}
      className={className}
    >
      {children}
    </button>
  )
}
