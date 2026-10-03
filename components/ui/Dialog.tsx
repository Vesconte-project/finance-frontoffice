'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { X } from 'lucide-react'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'
import { cn } from '@/lib/utils'
import styles from './Dialog.module.css'

type DialogProps = {
  open: boolean
  onClose: () => void
  /** Id of the element that names the dialog. */
  labelledBy: string
  /** Id of the element that describes the dialog. */
  describedBy?: string
  /** Receives focus when the dialog opens; defaults to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Receives focus again when the dialog closes. */
  returnFocusRef?: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}

/** Matches the exit animation in Dialog.module.css. */
const EXIT_MS = 200

/**
 * Modal dialog on the native `<dialog>` element.
 *
 * `showModal()` gives the browser's own focus containment, inert background,
 * top-layer stacking and Escape handling. On top of that: a click on the
 * backdrop closes, the shared scroll runtime is locked so the page behind
 * stays still, focus returns to the control that opened the dialog, and the
 * dialog animates out before it closes unless motion is reduced.
 */
export default function Dialog({
  open,
  onClose,
  labelledBy,
  describedBy,
  initialFocusRef,
  returnFocusRef,
  className,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const exitTimerRef = useRef<number | null>(null)
  const [closing, setClosing] = useState(false)
  const { runtime } = useScrollRuntime()

  const requestClose = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog?.open || exitTimerRef.current !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      dialog.close()
      return
    }
    setClosing(true)
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null
      setClosing(false)
      dialog.close()
    }, EXIT_MS)
  }, [])

  useEffect(() => () => {
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      initialFocusRef?.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocusRef])

  useEffect(() => {
    if (!open) return
    const release = runtime.acquireLock()
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      release()
      root.style.overflow = previousOverflow
    }
  }, [open, runtime])

  const handleClose = () => {
    onClose()
    returnFocusRef?.current?.focus()
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(styles.dialog, className)}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-lenis-prevent=""
      data-closing={closing ? 'true' : undefined}
      onClose={handleClose}
      onCancel={(event) => {
        // Escape: animate out first, then close.
        event.preventDefault()
        requestClose()
      }}
      onClick={(event) => {
        // Only the backdrop reports the dialog itself as the target.
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={requestClose}
        >
          <X size={16} aria-hidden="true" />
        </button>
        {children}
      </div>
    </dialog>
  )
}
