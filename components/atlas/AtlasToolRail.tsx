'use client'

import type { ReactNode } from 'react'
import type { ProFeature } from '@/lib/atlas-pro'
import styles from './AtlasPro.module.css'

export type AtlasTool = 'explore' | 'select' | 'compare' | 'test' | 'notebook' | 'groups'

const icon = (body: ReactNode) => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body}</svg>
)

const TOOLS: Array<{ tool: AtlasTool; label: string; feature: ProFeature | null; icon: ReactNode }> = [
  { tool: 'explore', label: 'Explore', feature: null, icon: icon(<path d="m5 3 14 7-6 2-2 6Z" />) },
  { tool: 'select', label: 'Select companies', feature: 'select', icon: icon(<><path d="M12 4c5 0 8 2.5 8 6s-3 6-8 6c-2 0-3 1-3 2.5" strokeDasharray="3 2.5" /><path d="M12 4C7 4 4 6.5 4 10c0 2 1 3.5 3 4.5" /></>) },
  { tool: 'compare', label: 'Compare', feature: 'compare', icon: icon(<><path d="M3 17c3-6 5-6 8-2s5 4 10-6" /><path d="M3 12c3 3 6 3 9-1s6-4 9 1" opacity="0.5" /></>) },
  { tool: 'test', label: 'Test a link', feature: 'test', icon: icon(<><circle cx="6" cy="7" r="3" /><circle cx="18" cy="17" r="3" /><path d="M8.5 9.5 15.5 14.5" strokeDasharray="2.5 2" /><path d="m13 15 2.7-.4.2-2.7" /></>) },
  { tool: 'notebook', label: 'Notebook', feature: 'notebook', icon: icon(<><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6Z" /><path d="M6 3v18M9.5 8h5M9.5 12h5" /></>) },
  { tool: 'groups', label: 'Groups', feature: 'groups', icon: icon(<><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><path d="M3 19c1-3 3-4.5 5-4.5s4 1.5 5 4.5M11 19c1-3 3-4.5 5-4.5s4 1.5 5 4.5" /></>) },
]

/**
 * The left tool rail (pro-spec §7). Every tool but Explore is Pro: readers
 * without it see a small accent dot, and a press opens the upsell instead.
 */
export default function AtlasToolRail({ pro, active, onTool, onLocked }: {
  pro: boolean
  active: ReadonlySet<AtlasTool>
  onTool: (tool: AtlasTool, anchor: HTMLElement) => void
  onLocked: (feature: ProFeature, anchor: HTMLElement) => void
}) {
  return (
    <nav className={styles.rail} aria-label="Tools" data-atlas-left="">
      {TOOLS.map(({ tool, label, feature, icon: glyph }) => (
        <button
          key={tool}
          type="button"
          title={label}
          aria-label={feature && !pro ? `${label}: Pro` : label}
          aria-pressed={active.has(tool)}
          data-locked={feature && !pro ? '' : undefined}
          data-tool={tool}
          onClick={(event) => (feature && !pro ? onLocked(feature, event.currentTarget) : onTool(tool, event.currentTarget))}
        >
          {glyph}
        </button>
      ))}
    </nav>
  )
}
