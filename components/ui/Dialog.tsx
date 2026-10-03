'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
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

/**
 * Modal dialog on the native `<dialog>` element.
 *
 * `showModal()` gives the browser's own focus containment, inert background,
 * top-layer stacking and Escape handling. On top of that: a click on the
 * backdrop closes, the shared scroll runtime is locked so the page behind
 * stays still, and focus returns to the control that opened the dialog.
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
  const { runtime } = useScrollRuntime()

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
      onClose={handleClose}
      onClick={(event) => {
        // Only the backdrop reports the dialog itself as the target.
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          <X size={16} aria-hidden="true" />
        </button>
        {children}
      </div>
    </dialog>
  )
}
