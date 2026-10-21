'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; match: (path: string) => boolean }

export default function LabNav({ unread, team }: { unread: number; team: boolean }) {
  const path = usePathname() ?? ''
  const items: NavItem[] = [
    { href: '/models', label: 'Theses', match: (p) => p === '/models' || p.startsWith('/models/theses') || p.startsWith('/models/tests') || p.startsWith('/models/compare') },
    { href: '/models/panels', label: 'Panels', match: (p) => p.startsWith('/models/panels') },
    { href: '/models/alerts', label: unread ? `Alerts (${unread})` : 'Alerts', match: (p) => p.startsWith('/models/alerts') },
    { href: '/models/new', label: 'New test', match: (p) => p.startsWith('/models/new') || p.startsWith('/models/runs') },
    ...(team ? [{ href: '/models/team', label: 'Team', match: (p: string) => p.startsWith('/models/team') }] : []),
  ]
  return (
    <nav aria-label="Model Lab" className="flex items-center gap-5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = item.match(path)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-10 items-center border-b-2 text-label-sm transition-colors focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
              active ? 'border-[var(--color-accent)] font-semibold text-content-primary' : 'border-transparent text-content-secondary hover:text-content-primary'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
