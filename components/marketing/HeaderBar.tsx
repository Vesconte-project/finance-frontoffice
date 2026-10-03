'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { ArrowRight, ChevronDown } from 'lucide-react'
import HeaderAccountControl from '@/components/HeaderAccountControl'
import HeaderSearch from '@/components/HeaderSearch'
import HeaderMenuPanel from '@/components/header-menu/HeaderMenuPanel'
import HeaderMenuTrigger from '@/components/header-menu/HeaderMenuTrigger'
import { HEADER_MENUS, accountMenu, type HeaderMenuData } from '@/components/header-menu/header-menus'
import { useHeaderDisclosure } from '@/components/header-menu/useHeaderDisclosure'
import { cn } from '@/lib/utils'
import { BRAND_NAME } from '@/components/marketing/site-config'

const PANEL_ID = 'site-header-menu'

export default function HeaderBar({ isHome }: { isHome: boolean }) {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const clerk = useClerk()
  const rowRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const menus = useMemo<HeaderMenuData[]>(() => {
    if (!isSignedIn) return HEADER_MENUS
    const blurb = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'Signed in.'
    return [...HEADER_MENUS, accountMenu(blurb)]
  }, [isSignedIn, user])

  const { openKey, displayed, toggle, close } = useHeaderDisclosure({ menus, rowRef, panelRef })

  return (
    <div
      ref={rowRef}
      data-site-header-row
      data-home={isHome ? '' : undefined}
      data-internal={!isHome ? '' : undefined}
      data-menu-open={openKey ? '' : undefined}
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
            <HeaderSearch className="w-full" maxSuggestions={3} placeholder="Search" />
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
            {HEADER_MENUS.map((m) => (
              <HeaderMenuTrigger
                key={m.key}
                expanded={openKey === m.key}
                controls={PANEL_ID}
                onToggle={(trigger, viaKeyboard) => toggle(m.key, trigger, viaKeyboard)}
                className="site-header__navlink site-nav__trigger"
              >
                {m.label}
                <ChevronDown className="site-nav__chev size-3.5" aria-hidden="true" />
              </HeaderMenuTrigger>
            ))}
          </nav>
          <HeaderAccountControl
            accountOpen={openKey === 'account'}
            controls={PANEL_ID}
            onToggleAccount={(trigger, viaKeyboard) => toggle('account', trigger, viaKeyboard)}
          />
        </div>
      </div>

      <HeaderMenuPanel
        id={PANEL_ID}
        menu={displayed}
        open={!!openKey}
        panelRef={panelRef}
        onNavigate={() => close()}
        intro={
          displayed?.kind === 'account' ? (
            <div className="site-header__tile-actions">
              <button
                type="button"
                className="site-header__tile-view"
                onClick={() => {
                  close()
                  void clerk.openUserProfile()
                }}
              >
                Manage account
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="site-header__tile-signout"
                onClick={() => {
                  close()
                  void clerk.signOut()
                }}
              >
                Sign out
              </button>
            </div>
          ) : undefined
        }
      />
    </div>
  )
}
