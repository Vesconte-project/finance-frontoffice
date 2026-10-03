'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { useScrollRuntime } from '@/components/motion/ScrollRuntime'

/* Matches the panel's own max-height transition, so the last menu stays mounted
   while it collapses. */
const CLOSE_UNMOUNT_MS = 440
const COMPACT_QUERY = '(max-width: 767px)'
const FOCUSABLE = 'a[href], button:not([disabled])'

type DisclosureMenu = { key: string }

/**
 * State and dismissal rules for the header's disclosures: the expanding menus
 * and, on compact screens, the search folded into the bar.
 *
 * One disclosure is open at a time. It closes on an outside press, Escape, a route
 * change, or real scrolling. On compact screens the open panel fills most of
 * the viewport, so the page underneath is locked through the shared scroll
 * runtime instead of being closed by the first touch scroll.
 */
export function useHeaderDisclosure<T extends DisclosureMenu>({
  menus,
  rowRef,
  panelRef,
}: {
  menus: T[]
  rowRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
}) {
  const { runtime } = useScrollRuntime()
  const pathname = usePathname()
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [displayed, setDisplayed] = useState<T | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const focusPanelOnOpen = useRef(false)

  const close = useCallback((options?: { restoreFocus?: boolean }) => {
    setOpenKey(null)
    if (options?.restoreFocus) returnFocus.current?.focus()
    returnFocus.current = null
  }, [])

  const toggle = useCallback(
    (key: string, trigger: HTMLElement, viaKeyboard: boolean) => {
      if (openKey === key) {
        close({ restoreFocus: viaKeyboard })
        return
      }
      if (clearTimer.current) clearTimeout(clearTimer.current)
      returnFocus.current = trigger
      // Keys without a menu (the search field) manage their own content and
      // focus; the menu panel keeps whatever it last showed while it closes.
      const menu = menus.find((m) => m.key === key)
      focusPanelOnOpen.current = viaKeyboard && !!menu
      if (menu) setDisplayed(menu)
      setOpenKey(key)
    },
    [close, menus, openKey]
  )

  // Keep the last menu mounted through the close transition.
  useEffect(() => {
    if (!openKey && displayed) {
      clearTimer.current = setTimeout(() => setDisplayed(null), CLOSE_UNMOUNT_MS)
    }
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current)
    }
  }, [openKey, displayed])

  // A keyboard user lands on the first destination; a pointer user keeps
  // their place and is not shown a focus ring they did not ask for.
  useEffect(() => {
    if (!openKey || !focusPanelOnOpen.current) return
    focusPanelOnOpen.current = false
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
  }, [openKey, displayed, panelRef])

  // Any navigation, including one started outside the header, closes it.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (lastPathname !== pathname) {
    setLastPathname(pathname)
    setOpenKey(null)
  }

  // Page dim, and the compact-screen scroll lock.
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('has-header-menu', !!openKey)
    if (!openKey) return
    const release = window.matchMedia(COMPACT_QUERY).matches ? runtime.acquireLock() : null
    return () => {
      root.classList.remove('has-header-menu')
      release?.()
    }
  }, [openKey, runtime])

  // Close on outside press / Escape / real scroll.
  useEffect(() => {
    if (!openKey) return
    // pointerdown, not mousedown: iOS only synthesizes mouse events for
    // elements it considers clickable, so a tap on the dimmed page never closed.
    // The close waits for the press to finish, though: closing on pointerdown
    // lifted the backdrop before the click, so the same tap landed on whatever
    // was underneath (the homepage constellation zoomed into a node). While the
    // menu is still open the click hits the backdrop and is spent there. The
    // timeout covers presses that never produce a click (iOS, cancelled taps).
    let pendingClose: (() => void) | null = null
    const onDown = (e: PointerEvent) => {
      if (rowRef.current?.contains(e.target as Node) || pendingClose) return
      const timer = window.setTimeout(() => finish(), 700)
      const onClickAfter = (event: MouseEvent) => {
        event.preventDefault()
        finish()
      }
      const finish = () => {
        window.clearTimeout(timer)
        window.removeEventListener('click', onClickAfter, true)
        pendingClose = null
        close()
      }
      pendingClose = () => {
        window.clearTimeout(timer)
        window.removeEventListener('click', onClickAfter, true)
      }
      window.addEventListener('click', onClickAfter, true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close({ restoreFocus: !!rowRef.current?.contains(document.activeElement) })
    }
    // Close on real scrolling, not on any scroll event. Lenis drives the page
    // through window.scrollTo inside a continuous rAF, so opening the menu —
    // which resizes the header and can trigger a Lenis resize — lands a
    // zero-delta scroll event on the frame right after opening. Closing on that
    // is what made the first click only expand the bar.
    const openedAt = window.scrollY
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedAt) > 24) close()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      pendingClose?.()
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [openKey, rowRef, close])

  return { openKey, displayed, toggle, close }
}
