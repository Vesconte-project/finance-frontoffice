'use client'

import { useScrollSpy } from '@/hooks/useScrollSpy'

export type StickySection = {
  id: string
  label: string
}

function itemClass(active: boolean): string {
  if (active) {
    return 'state-interactive relative rounded-[var(--radius-md)] bg-surface-hover py-2.5 pl-4 pr-3 text-left text-label-sm font-semibold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg'
  }
  return 'state-interactive relative rounded-[var(--radius-md)] py-2.5 pl-4 pr-3 text-left text-label-sm font-medium text-content-secondary hover:bg-surface-hover hover:text-content-primary active:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg'
}

export default function StickySectionNav({
  sections,
  offset = 112,
}: {
  sections: StickySection[]
  offset?: number
}) {
  const activeId = useScrollSpy(
    sections.map((section) => section.id),
    offset
  )

  const scrollTo = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return
    const target = element.getBoundingClientRect().top + window.scrollY - offset + 4
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  if (sections.length === 0) return null

  return (
    <aside data-analytics-surface="section_nav" className="sticky top-24 hidden w-44 shrink-0 self-start xl:block">
      <div className="px-2 text-label-sm uppercase tracking-[0.16em] text-content-muted">
        On this page
      </div>
      <nav className="relative mt-3 ml-2 space-y-1 border-l border-border">
        {sections.map((section) => {
          const active = section.id === activeId
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollTo(section.id)}
              className={itemClass(active)}
            >
              {active ? (
                <span className="absolute -left-px top-0 h-full w-[2px] rounded bg-primary" />
              ) : null}
              {section.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
