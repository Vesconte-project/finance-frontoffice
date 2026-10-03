'use client'

import type { ReactNode, Ref } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import type { HeaderMenuData, HeaderMenuTileData } from '@/components/header-menu/header-menus'

/**
 * The area a header menu expands into.
 *
 * Its layout follows the viewport in CSS alone: a row of tiles on desktop, a
 * two-column grid on tablets, and a vertical list on phones. Nothing here
 * branches on screen size, so every width renders the same menu.
 */
export default function HeaderMenuPanel({
  id,
  menu,
  open,
  panelRef,
  onNavigate,
  intro,
}: {
  id: string
  menu: HeaderMenuData | null
  open: boolean
  panelRef?: Ref<HTMLDivElement>
  onNavigate: () => void
  /** Replaces the intro's View link (the account menu's actions). */
  intro?: ReactNode
}) {
  return (
    <div
      id={id}
      ref={panelRef}
      className="site-header__dropdowns"
      data-lenis-prevent
      aria-hidden={!open}
      inert={!open ? true : undefined}
    >
      {menu ? (
        <div
          className="site-header__dropgrid"
          style={{ ['--menu-tiles' as string]: String(menu.tiles.length) }}
        >
          <HeaderMenuIntro eyebrow={menu.label} blurb={menu.blurb}>
            {intro ?? <HeaderMenuViewLink href={menu.href} onNavigate={onNavigate} />}
          </HeaderMenuIntro>
          {menu.tiles.map((tile) => (
            <HeaderMenuTile key={tile.label} tile={tile} onNavigate={onNavigate} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function HeaderMenuIntro({
  eyebrow,
  blurb,
  children,
}: {
  eyebrow: string
  blurb: string
  children: ReactNode
}) {
  return (
    <div className="site-header__tile site-header__tile--text">
      <div>
        <p className="site-header__tile-eyebrow">{eyebrow}</p>
        <p className="site-header__tile-blurb">{blurb}</p>
      </div>
      {children}
    </div>
  )
}

export function HeaderMenuViewLink({ href, onNavigate }: { href: string; onNavigate: () => void }) {
  return (
    <Link href={href} className="site-header__tile-view" onClick={onNavigate}>
      View
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  )
}

export function HeaderMenuTile({
  tile,
  onNavigate,
}: {
  tile: HeaderMenuTileData
  onNavigate: () => void
}) {
  return (
    <Link href={tile.href} onClick={onNavigate} className="site-header__tile">
      <span className="site-header__tile-media" aria-hidden="true" />
      <span className="site-header__tile-label">{tile.label}</span>
      <ChevronRight className="site-header__tile-chevron size-4" aria-hidden="true" />
    </Link>
  )
}
