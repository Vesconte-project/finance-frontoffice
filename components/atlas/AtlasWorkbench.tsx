'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { compareChart, testRows, type SelectionSummary } from '@/lib/atlas-pro'
import type { AtlasCompare, AtlasTest } from '@/lib/atlas-pro-model'
import { formatCap } from './atlas-format'
import type { Remote } from './use-atlas-json'
import styles from './AtlasPro.module.css'

export type DockKind = 'compare' | 'test'
/** Something a dock can compare or test: the selection, a company, a saved group or a region. */
export type DockSource = { key: string; label: string; count: number }

/** The selection tray (pro-spec §7): what is selected, and what can be done with it. */
export function AtlasTray({ summary, groupCount, onCompare, onTest, onSave, onNote, onClear }: {
  summary: SelectionSummary
  groupCount: number
  onCompare: () => void
  onTest: () => void
  onSave: (name: string) => void
  onNote: () => void
  onClear: () => void
}) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (naming) input.current?.focus()
  }, [naming])
  const save = () => {
    onSave(name.trim() || `Group ${groupCount + 1}`)
    setNaming(false)
    setName('')
  }
  const cap = formatCap(summary.marketCap)
  return (
    <div className={styles.tray} role="region" aria-label="Selection">
      <span className={styles.traySummary}>
        <span><b>{summary.companies}</b> {summary.companies === 1 ? 'company' : 'companies'}</span>
        <span><b>{summary.regions}</b> {summary.regions === 1 ? 'region' : 'regions'}</span>
        {cap ? <span><b>{cap}</b></span> : null}
      </span>
      <span className={styles.trayActions}>
        <button type="button" onClick={onCompare}>Compare</button>
        <button type="button" onClick={onTest}>Test link</button>
        {naming ? (
          <>
            <input
              ref={input}
              type="text"
              placeholder="Group name"
              aria-label="Group name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === 'Enter') save()
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  setNaming(false)
                }
              }}
            />
            <button type="button" onClick={save}>Save</button>
          </>
        ) : (
          <button type="button" onClick={() => setNaming(true)}>Save group</button>
        )}
        <button type="button" onClick={onNote}>Note</button>
        <button type="button" onClick={onClear} aria-label="Clear the selection">Clear</button>
      </span>
    </div>
  )
}

type TestState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: AtlasTest; run: number } | { status: 'invalid' } | { status: 'error' }

/** The Compare and Test a link dock (pro-spec §7): two pickers and what the backend answers for them. */
export function AtlasDock({ kind, sources, a, b, onPick, onClose, compare, test, testsRun, onRun, onNote, closeRef }: {
  kind: DockKind
  sources: DockSource[]
  a: string
  b: string
  onPick: (a: string, b: string) => void
  onClose: () => void
  compare: Remote<AtlasCompare>
  test: TestState
  testsRun: number
  onRun: () => void
  onNote: () => void
  closeRef?: (element: HTMLButtonElement | null) => void
}) {
  const id = useId()
  const title = kind === 'compare' ? 'Compare' : 'Test a link'
  const picker = (which: 'a' | 'b', value: string) => (
    <select id={`${id}-${which}`} value={value} onChange={(event) => (which === 'a' ? onPick(event.target.value, b) : onPick(a, event.target.value))}>
      {sources.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}
    </select>
  )
  return (
    <section className={styles.dock} aria-labelledby={`${id}-title`} aria-live="polite" data-lenis-prevent="">
      <div className={styles.dockHead}>
        <h2 id={`${id}-title`} className={styles.eyebrow}>{title}</h2>
        <button ref={closeRef} type="button" className={styles.dockClose} onClick={onClose} aria-label={`Close ${title}`}><X size={15} aria-hidden="true" /></button>
      </div>
      {sources.length < 2 ? (
        <p className={styles.empty}>Pick two different sets.</p>
      ) : (
        <>
          <div className={styles.dockPick}>
            <label htmlFor={`${id}-a`}>{kind === 'test' ? 'From' : 'A'}</label>
            {picker('a', a)}
            <label htmlFor={`${id}-b`}>{kind === 'test' ? 'To' : 'B'}</label>
            {picker('b', b)}
          </div>
          {kind === 'compare' ? <CompareBody compare={compare} labelA={sources.find((s) => s.key === a)?.label ?? a} labelB={sources.find((s) => s.key === b)?.label ?? b} onNote={onNote} />
            : <TestBody test={test} testsRun={testsRun} onRun={onRun} onNote={onNote} />}
        </>
      )}
    </section>
  )
}

function CompareBody({ compare, labelA, labelB, onNote }: { compare: Remote<AtlasCompare>; labelA: string; labelB: string; onNote: () => void }) {
  if (compare.status === 'loading' || compare.status === 'idle') return <p className={styles.muted} role="status">Loading…</p>
  if (compare.status === 'invalid') return <p className={styles.empty}>Pick two different sets.</p>
  if (compare.status !== 'ok') return <p className={styles.empty}>This comparison could not load.</p>
  const data = compare.data
  const chart = compareChart(data.series.map((point) => point.value))
  const number = (value: number | null) => (value === null ? '—' : value.toFixed(2))
  return (
    <>
      {chart ? (
        <svg className={styles.chart} viewBox="0 0 560 120" role="img" aria-label={`Correlation between ${labelA} and ${labelB}, three-month windows over the last year`}>
          <line x1="6" x2="554" y1={chart.zero} y2={chart.zero} stroke="var(--line)" />
          <text x="554" y={chart.zero - 3} fontSize="9" textAnchor="end" fill="var(--text-muted)">0</text>
          <line x1="6" x2="554" y1={chart.half} y2={chart.half} stroke="var(--line)" strokeDasharray="2 3" />
          <text x="554" y={chart.half - 3} fontSize="9" textAnchor="end" fill="var(--text-muted)">0.5</text>
          <path d={chart.path} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
          <text x="6" y="119" fontSize="9" textAnchor="start" fill="var(--text-muted)">12 mo ago</text>
          <text x="280" y="119" fontSize="9" textAnchor="middle" fill="var(--text-muted)">6 mo ago</text>
          <text x="554" y="119" fontSize="9" textAnchor="end" fill="var(--text-muted)">today</text>
        </svg>
      ) : <p className={styles.empty}>Not enough shared history for a line.</p>}
      <div className={styles.dockNumbers}>
        <span>Year <b>{number(data.year)}</b></span>
        <span>First half <b>{number(data.firstHalf)}</b></span>
        <span>Second half <b>{number(data.secondHalf)}</b></span>
        <span>Last 3 months <b>{number(data.last3Months)}</b></span>
        <span>{data.a.count} vs {data.b.count} companies</span>
      </div>
      <p className={styles.dockFoot}>
        Correlation of the two sets&apos; average daily move beyond the market, in three-month windows.{' '}
        <button type="button" className={styles.chip} onClick={onNote}>Note</button>
      </p>
    </>
  )
}

function TestBody({ test, testsRun, onRun, onNote }: { test: TestState; testsRun: number; onRun: () => void; onNote: () => void }) {
  if (test.status === 'loading') return <p className={styles.muted} role="status">Running the test…</p>
  if (test.status === 'done') {
    const rows = testRows(test.result, test.run)
    if (!rows) {
      return (
        <>
          <p className={styles.empty}>
            {test.result.available === false && test.result.reason === 'needs_two_years' ? 'Needs two years of history.' : 'The test needs data these companies do not have yet.'}
          </p>
          <button type="button" className={styles.chip} onClick={onRun}>Run again</button>
        </>
      )
    }
    const counts = test.result.available ? test.result : null
    return (
      <>
        <table className={styles.testTable}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className={styles.number}>{row.value}</td>
                <td className={row.pass ? styles.pass : styles.fail} aria-label={row.pass ? 'meets the threshold' : 'does not meet the threshold'}>{row.pass ? '✓' : '✗'}</td>
                <td>{row.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.dockFoot}>
          {counts?.fromCount !== null && counts?.fromCount !== undefined && counts.toCount !== null ? `${counts.fromCount} → ${counts.toCount} companies · ` : ''}
          two years of report days · test {test.run} of this session.{' '}
          <button type="button" className={styles.chip} onClick={onRun}>Run again</button>{' '}
          <button type="button" className={styles.chip} onClick={onNote}>Note</button>
        </p>
      </>
    )
  }
  return (
    <>
      {test.status === 'invalid' ? <p className={styles.empty}>Pick two different sets.</p> : null}
      {test.status === 'error' ? <p className={styles.empty}>The test could not run. Try again.</p> : null}
      <button type="button" className={styles.chip} onClick={onRun}>Run the test</button>
      <p className={styles.dockFoot}>Tests run in this session: {testsRun}. Each one raises the bar for the next.</p>
    </>
  )
}

export type { TestState }
