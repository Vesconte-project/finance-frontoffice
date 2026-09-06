'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown } from 'lucide-react'
import HeaderAccountControl from '@/components/HeaderAccountControl'
import TileArt, { type TileArtKey } from '@/components/marketing/TileArt'
import HeaderSearch from '@/components/HeaderSearch'
import { cn } from '@/lib/utils'
import { BRAND_NAME } from '@/components/marketing/site-config'

type Tile = {
  label: string
  href: string
  grad: string
  lightGrad: string
  art?: TileArtKey
  /* Two stops the inline artwork's gradient reads, per theme. */
  inkA?: string
  inkB?: string
  inkALight?: string
  inkBLight?: string
}
type Menu = { key: string; label: string; href: string; blurb: string; tiles: Tile[] }

// Placeholder content — the media tiles use gradient placeholders instead of
// photography for now. Swap copy/links/images when ready.
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
      {
        label: 'Long term',
        href: '/picks/long-term',
        grad: 'linear-gradient(150deg,#3a4d8f,#0b1730)',
        lightGrad: 'linear-gradient(145deg,#d6e3f6,#f1f5fc 74%)',
        art: 'long-term',
        inkA: '#5d88ca',
        inkB: '#a8c8f2',
        inkALight: '#16345f',
        inkBLight: '#3568b4',
      },
      {
        label: 'Income',
        href: '/picks/income',
        grad: 'linear-gradient(150deg,#0f9e8e,#0a3a44)',
        lightGrad: 'linear-gradient(145deg,#c8ece2,#eefaf5 74%)',
        art: 'income',
        inkA: '#2ba192',
        inkB: '#7fdecb',
        inkALight: '#07524f',
        inkBLight: '#0b9c8b',
      },
      {
        label: 'Short term',
        href: '/picks/short-term',
        grad: 'linear-gradient(145deg,#8a5a37,#301a0b)',
        lightGrad: 'linear-gradient(145deg,#f7e0c9,#fdf3e8 74%)',
        art: 'short-term',
        inkA: '#cd7c3d',
        inkB: '#f5bd85',
        inkALight: '#8a3d18',
        inkBLight: '#cf7526',
      },
    ],
  },
  {
    key: 'correlation',
    label: 'Correlation',
    href: '/markets/network',
    blurb: 'How names move together — the network, the pairs that track each other, and where a sector ends.',
    tiles: [
      { label: 'Network', href: '/markets/network', grad: 'linear-gradient(150deg,#0f9e8e,#0a3a44)', lightGrad: 'linear-gradient(145deg,#d9eee9,#f4efe5 72%)' },
      { label: 'Pairs', href: '/markets', grad: 'linear-gradient(145deg,#8a5a37,#301a0b)', lightGrad: 'linear-gradient(145deg,#eee4d9,#f4efe5 72%)' },
      { label: 'Sectors', href: '/markets', grad: 'linear-gradient(150deg,#3a4d8f,#0b1730)', lightGrad: 'linear-gradient(145deg,#dfe8ee,#f4efe5 72%)' },
      {
        label: 'Signals',
        href: '/screener',
        grad: 'linear-gradient(150deg,#5b3d8c,#160c30)',
        lightGrad: 'linear-gradient(145deg,#e3dbf3,#f6f2fb 74%)',
        art: 'signals',
        inkA: '#8d6ec9',
        inkB: '#c4b0ec',
        inkALight: '#3d2470',
        inkBLight: '#6b45b8',
      },
    ],
  },
]

export default function HeaderBar({ isHome }: { isHome: boolean }) {
  const [open, setOpen] = useState<string | null>(null)
  const [displayed, setDisplayed] = useState<Menu | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    setDisplayed(MENUS.find((m) => m.key === key) ?? null)
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
          className="site-header__brand marketing-logo-type shrink-0 pl-1 font-bold tracking-[-0.01em] text-content-primary transition-opacity hover:opacity-80 md:justify-self-start"
        >
          <span className="site-header__brand-full">{BRAND_NAME}</span>
          <span className="site-header__brand-short" aria-hidden="true">
            lb
          </span>
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
          <nav className="hidden items-center md:flex">
            {MENUS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-expanded={open === m.key}
                aria-haspopup="menu"
                // Focus lands on mousedown, and focusing the row widens the
                // condensed pill — the trigger shifted out from under the cursor
                // before mouseup, so no click was ever emitted and the menu took
                // two presses. Take focus after the press instead, by which point
                // data-menu-open holds the row at its wide size anyway.
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.currentTarget.focus()
                  toggleMenu(m.key)
                }}
                className="site-header__navlink site-nav__trigger"
              >
                {m.label}
                <ChevronDown className="site-nav__chev size-3.5" aria-hidden="true" />
              </button>
            ))}
          </nav>
          <HeaderAccountControl />
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
              <Link href={displayed.href} className="site-header__tile-view" onClick={() => setOpen(null)}>
                View
                <ArrowRight className="size-4" />
              </Link>
            </div>
            {displayed.tiles.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                onClick={() => setOpen(null)}
                className="site-header__tile"
                data-art={t.art ?? undefined}
                style={{
                  ['--tile-grad' as string]: t.grad,
                  ['--tile-grad-light' as string]: t.lightGrad,
                  ...(t.inkA ? { ['--ink-a-dark' as string]: t.inkA } : null),
                  ...(t.inkB ? { ['--ink-b-dark' as string]: t.inkB } : null),
                  ...(t.inkALight ? { ['--ink-a-light' as string]: t.inkALight } : null),
                  ...(t.inkBLight ? { ['--ink-b-light' as string]: t.inkBLight } : null),
                }}
              >
                <span className="site-header__tile-media" aria-hidden="true" />
                {t.art ? (
                  <span className="site-header__tile-art" aria-hidden="true">
                    <TileArt art={t.art} />
                  </span>
                ) : null}
                <span className="site-header__tile-label">{t.label}</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
