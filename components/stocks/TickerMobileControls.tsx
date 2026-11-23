'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useAuth, useClerk } from '@clerk/nextjs'
import { Menu, Search } from 'lucide-react'
import Dialog from '@/components/ui/Dialog'
import HeaderSearch from '@/components/HeaderSearch'
import { ACCOUNT_MENU_TILES, HEADER_MENUS } from '@/components/header-menu/header-menus'
import { buttonClass } from '@/components/ui/Button'
import styles from './TickerMobileControls.module.css'

/**
 * Search and menu for the ticker page on a phone, where the site header and the
 * ticker header are one band (PRD-84, founder decision 2026-11-23). The menu
 * opens with the ticker's own actions, then the site's sections and the
 * account. Hidden from tablet width up, where the site header stays.
 */
export default function TickerMobileControls({
  ticker,
  tickerActions,
}: {
  ticker: string
  /** The ticker's actions as menu lines (currency, export); absent while loading. */
  tickerActions?: ReactNode
}) {
  // What is open, and on which address: any navigation (a search pick, a menu
  // link, a currency choice) leaves the address behind and so closes it.
  const [opened, setOpened] = useState<{ kind: 'search' | 'menu'; at: string } | null>(null)
  const searchButton = useRef<HTMLButtonElement>(null)
  const menuButton = useRef<HTMLButtonElement>(null)
  const searchTitle = useId()
  const menuTitle = useId()
  const pathname = usePathname()
  const query = useSearchParams()?.toString() ?? ''
  const address = `${pathname}?${query}`
  const searchOpen = opened?.kind === 'search' && opened.at === address
  const menuOpen = opened?.kind === 'menu' && opened.at === address
  const setSearchOpen = (open: boolean) => setOpened(open ? { kind: 'search', at: address } : null)
  const setMenuOpen = (open: boolean) => setOpened(open ? { kind: 'menu', at: address } : null)
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()

  // The search field takes the keyboard as soon as the dialog opens.
  useEffect(() => {
    if (!searchOpen) return
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-ticker-mobile-search] input')?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [searchOpen])

  return (
    <div className={styles.controls} data-ticker-mobile-controls="">
      <button
        ref={searchButton}
        type="button"
        className={styles.button}
        aria-label="Search tickers or companies"
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        onClick={() => setSearchOpen(true)}
      >
        <Search size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <button
        ref={menuButton}
        type="button"
        className={styles.button}
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
        data-ticker-mobile-menu-trigger=""
      >
        <Menu size={20} strokeWidth={1.6} aria-hidden="true" />
      </button>

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        labelledBy={searchTitle}
        returnFocusRef={searchButton}
        className={styles.sheet}
      >
        <div className={styles.sheetBody} data-ticker-mobile-search="">
          <h2 id={searchTitle} className={styles.sheetTitle}>Search</h2>
          <HeaderSearch className="w-full" />
        </div>
      </Dialog>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        labelledBy={menuTitle}
        returnFocusRef={menuButton}
        className={styles.sheet}
      >
        <div className={styles.sheetBody} data-ticker-mobile-menu="">
          <h2 id={menuTitle} className={styles.sheetTitle}>Menu</h2>

          {tickerActions ? (
            <section className={styles.group} aria-label={`${ticker} actions`} data-ticker-mobile-menu-actions="">
              <p className={styles.groupLabel}>{ticker}</p>
              <div className={styles.lines}>{tickerActions}</div>
            </section>
          ) : null}

          <nav className={styles.group} aria-label="Site">
            {HEADER_MENUS.map((menu) => (
              <div key={menu.key} className={styles.section}>
                <Link prefetch={false} href={menu.href} className={styles.sectionLink}>{menu.label}</Link>
                <ul className={styles.tiles}>
                  {menu.tiles.map((tile) => (
                    <li key={`${tile.label}-${tile.href}`}>
                      <Link prefetch={false} href={tile.href} className={styles.tile}>{tile.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {isLoaded ? (
            isSignedIn ? (
              <nav className={styles.group} aria-label="Account">
                <p className={styles.groupLabel}>Account</p>
                <ul className={styles.tiles}>
                  {ACCOUNT_MENU_TILES.map((tile) => (
                    <li key={tile.href}>
                      <Link prefetch={false} href={tile.href} className={styles.tile}>{tile.label}</Link>
                    </li>
                  ))}
                </ul>
                <div className={styles.accountActions}>
                  <button
                    type="button"
                    className={buttonClass({ variant: 'ghost', size: 'md' })}
                    onClick={() => {
                      setMenuOpen(false)
                      void clerk.openUserProfile()
                    }}
                  >
                    Manage account
                  </button>
                  <button
                    type="button"
                    className={buttonClass({ variant: 'ghost', size: 'md' })}
                    onClick={() => {
                      setMenuOpen(false)
                      void clerk.signOut()
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </nav>
            ) : (
              <div className={styles.join}>
                <Link
                  prefetch={false}
                  href="/sign-up"
                  data-analytics-id="ticker_menu_join"
                  data-analytics-event="auth_start"
                  data-analytics-intent="sign_up"
                  className={buttonClass({ variant: 'primary', size: 'md' })}
                >
                  Join
                </Link>
                <Link prefetch={false} href="/sign-in" className={buttonClass({ variant: 'ghost', size: 'md' })}>
                  Sign in
                </Link>
              </div>
            )
          ) : null}
        </div>
      </Dialog>
    </div>
  )
}
