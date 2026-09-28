'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { ArrowRight, ChevronDown } from 'lucide-react'
import HeaderAccountControl from '@/components/HeaderAccountControl'
import HeaderSearch from '@/components/HeaderSearch'
import { cn } from '@/lib/utils'
import { BRAND_NAME } from '@/components/marketing/site-config'

type Tile = {
  label: string
  href: string
}
type Menu = {
  key: string
  label: string
  href: string
  blurb: string
  tiles: Tile[]
  /* The account menu swaps the text tile's single View link for the two account
     actions, which are Clerk calls rather than routes. */
  kind?: 'account'
}

const MENUS: Menu[] = [
  {
    key: 'today',
    label: 'Today',
    href: '/dashboard',
    blurb: 'The market changes every day. The kind of investor you are does not. Start there.',
    // The three readings are one measurement seen from three horizons, not three
    // weightings of one score — short term barely touches the axes the other two
    // live on.
    tiles: [
      { label: 'Long term', href: '/picks/long-term' },
      { label: 'Income', href: '/picks/income' },
      { label: 'Short term', href: '/picks/short-term' },
    ],
  },
  {
    key: 'correlation',
    label: 'Correlation',
    href: '/markets/network',
    blurb: 'How names move together — the network, the pairs that track each other, and where a sector ends.',
    tiles: [
      { label: 'Network', href: '/markets/network' },
      { label: 'Pairs', href: '/markets' },
      { label: 'Sectors', href: '/markets' },
      { label: 'Signals', href: '/screener' },
    ],
  },
]

const ACCOUNT_TILES: Tile[] = [
  { label: 'Watchlist', href: '/dashboard/watchlist' },
  { label: 'Alerts', href: '/dashboard/alerts' },
  { label: 'Model Lab', href: '/models' },
  { label: 'Community', href: '/community' },
]

export default function HeaderBar({ isHome }: { isHome: boolean }) {
  const router = useRouter()
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const [open, setOpen] = useState<string | null>(null)
  const [displayed, setDisplayed] = useState<Menu | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const menus = useMemo<Menu[]>(() => {
    if (!isSignedIn) return MENUS
    return [
      ...MENUS,
      {
        key: 'account',
        label: 'Account',
        href: '/dashboard',
        blurb: user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'Signed in.',
        tiles: ACCOUNT_TILES,
        kind: 'account',
      },
    ]
  }, [isSignedIn, user])

  // Keep the last menu mounted through the close transition.
  useEffect(() => {
    if (!open && displayed) {
      clearTimer.current = setTimeout(() => setDisplayed(null), 440)
    }
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current)
    }
  }, [open, displayed])

  function toggleMenu(key: string) {
    if (open === key) {
      setOpen(null)
      return
    }
    if (clearTimer.current) clearTimeout(clearTimer.current)
    setDisplayed(menus.find((m) => m.key === key) ?? null)
    setOpen(key)
  }

  // Backdrop dim over the page.
  useEffect(() => {
    document.documentElement.classList.toggle('has-header-menu', !!open)
    return () => document.documentElement.classList.remove('has-header-menu')
  }, [open])

  // Close on outside-click / Escape / scroll.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    // Close on real scrolling, not on any scroll event. Lenis drives the page
    // through window.scrollTo inside a continuous rAF, so opening the menu —
    // which resizes the header and can trigger a Lenis resize — lands a
    // zero-delta scroll event on the frame right after setOpen. Closing on that
    // is what made the first click only expand the bar.
    const openedAt = window.scrollY
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedAt) > 24) setOpen(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [open])

  return (
    <div
      ref={rowRef}
      data-site-header-row
      data-home={isHome ? '' : undefined}
      data-internal={!isHome ? '' : undefined}
      data-menu-open={open ? '' : undefined}
      className="site-header__row"
    >
      <div
        className={cn(
          'site-header__bar flex items-center gap-4',
          !isHome && 'justify-between md:grid md:grid-cols-[1fr_auto_1fr]'
        )}
      >
        <Link
          href="/"
          aria-label={BRAND_NAME}
          data-analytics-id="header_brand_home"
          className="site-header__brand marketing-logo-type shrink-0 pl-1 text-content-primary transition-opacity hover:opacity-80 md:justify-self-start"
        >
          <span className="site-header__brand-full">{BRAND_NAME}</span>
        </Link>

        {isHome ? (
          <div data-pill-search className="site-header__pill-search hidden md:block">
            {/* Condensed chrome — a short list reads as a shortcut, not a browser. */}
            <HeaderSearch className="w-full" maxSuggestions={3} placeholder="Search…" />
          </div>
        ) : (
          <div
            data-header-search
            className="site-header__search hidden w-full min-w-0 max-w-[520px] md:block md:justify-self-center"
          >
            <HeaderSearch className="w-full" />
          </div>
        )}

        <div
          className={cn(
            'flex shrink-0 items-center gap-1.5',
            'site-header__cluster md:justify-self-end'
          )}
        >
          <nav data-analytics-surface="site_header" className="flex items-center">
            {MENUS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-expanded={open === m.key}
                aria-haspopup="menu"
                // Focus lands on mousedown, and focusing the row widens the
                // condensed pill — the trigger shifted out from under the cursor
                // before mouseup, so no click was ever emitted and the menu took
                // two presses. Preventing that mousedown is the fix.
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  // Below md there's no room for the tile mega-menu, and it was
                  // never reachable there at all before — go straight to the
                  // page instead of opening a panel designed for a wide screen.
                  if (window.matchMedia('(max-width: 767px)').matches) {
                    router.push(m.href)
                    return
                  }
                  // `detail` is 0 for keyboard activation, where focus must stay
                  // put. A pointer click releases it: suppressing the mousedown
                  // focus above makes the browser read any focus landing
                  // afterwards as keyboard-driven, so the ring stayed lit on the
                  // previous trigger after switching menus — and :focus-within
                  // holds the condensed row open once data-menu-open is gone.
                  if (event.detail > 0) event.currentTarget.blur()
                  else event.currentTarget.focus()
                  toggleMenu(m.key)
                }}
                className="site-header__navlink site-nav__trigger"
              >
                {m.label}
                <ChevronDown className="site-nav__chev size-3.5 max-md:hidden" aria-hidden="true" />
              </button>
            ))}
          </nav>
          <HeaderAccountControl
            accountOpen={open === 'account'}
            onToggleAccount={() => toggleMenu('account')}
          />
        </div>
      </div>

      <div className="site-header__dropdowns" aria-hidden={!open} inert={!open ? true : undefined}>
        {displayed ? (
          <div
            className="site-header__dropgrid"
            // The grid was fixed at three tiles; Correlation now carries four.
            style={{ ['--menu-tiles' as string]: String(displayed.tiles.length) }}
          >
            <div className="site-header__tile site-header__tile--text">
              <div>
                <p className="site-header__tile-eyebrow">{displayed.label}</p>
                <p className="site-header__tile-blurb">{displayed.blurb}</p>
              </div>
              {displayed.kind === 'account' ? (
                <div className="site-header__tile-actions">
                  <button
                    type="button"
                    className="site-header__tile-view"
                    onClick={() => {
                      setOpen(null)
                      void clerk.openUserProfile()
                    }}
                  >
                    Manage account
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    className="site-header__tile-signout"
                    onClick={() => {
                      setOpen(null)
                      void clerk.signOut()
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <Link href={displayed.href} className="site-header__tile-view" onClick={() => setOpen(null)}>
                  View
                  <ArrowRight className="size-4" />
                </Link>
              )}
            </div>
            {displayed.tiles.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                onClick={() => setOpen(null)}
                className="site-header__tile"
              >
                <span className="site-header__tile-media" aria-hidden="true" />
                <span className="site-header__tile-label">{t.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
