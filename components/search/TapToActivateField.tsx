'use client'

import { useRef, useState, type FocusEvent, type ReactNode } from 'react'

/**
 * Keeps a text field inert until the reader asks for it.
 *
 * Chrome on Android decides when the page loads which fields to treat as form
 * inputs, and raises its password/card/address bar over the keyboard for
 * them; autocomplete="off" does not change that. A field that is inert at
 * load and only becomes live inside the tap that focuses it never gets the
 * bar, which is how the header's search already behaved. This wrapper gives
 * any field the same treatment: a tap or keyboard focus on the wrapper wakes
 * the field and focuses it in the same gesture (so the phone keyboard opens),
 * and leaving the field puts it back to sleep.
 */
export default function TapToActivateField({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const [active, setActive] = useState(false)
  const innerRef = useRef<HTMLDivElement>(null)

  function activate() {
    const inner = innerRef.current
    if (!inner) return
    // React clears `inert` on the next render; focus has to land now.
    inner.inert = false
    inner.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    setActive(true)
  }

  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setActive(false)
  }

  return (
    <div
      className={className}
      // A Tab stop only while asleep: focus passes straight on to the field.
      tabIndex={active ? -1 : 0}
      data-field-active={active ? 'true' : 'false'}
      onClick={() => {
        if (!active) activate()
      }}
      onFocus={(event) => {
        if (!active && event.target === event.currentTarget) activate()
      }}
      onBlur={onBlur}
    >
      <div ref={innerRef} inert={!active ? true : undefined}>
        {children}
      </div>
    </div>
  )
}
