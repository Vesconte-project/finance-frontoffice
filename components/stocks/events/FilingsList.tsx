'use client'

import { useMemo, useState } from 'react'
import FilterChip from '@/components/ui/FilterChip'
import { FILING_GROUP_LABEL, type FilingGroup } from '@/lib/filing-labels'
import styles from './FilingsList.module.css'

export type Filing = {
  key: string
  date: string
  label: string
  group: FilingGroup
  code: string | null
  detail: string | null
  url: string
}

const GROUPS: FilingGroup[] = ['results', 'insiders', 'holders', 'meetings', 'other']
const FIRST = 12

function monthLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 7)}-01T00:00:00Z`))
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`))
}

/**
 * Filed documents with plain names ("Quarterly report", "Insider trade"),
 * grouped by month, newest first, with a filter by kind. The form code stays
 * beside the name, and every row opens the document at its source.
 */
export default function FilingsList({ filings }: { filings: Filing[] }) {
  const [group, setGroup] = useState<FilingGroup | 'all'>('all')
  const [expanded, setExpanded] = useState(false)
  const counts = useMemo(() => {
    const byGroup = new Map<FilingGroup, number>()
    for (const filing of filings) byGroup.set(filing.group, (byGroup.get(filing.group) ?? 0) + 1)
    return byGroup
  }, [filings])
  const shown = group === 'all' ? filings : filings.filter((filing) => filing.group === group)
  const visible = expanded ? shown : shown.slice(0, FIRST)
  const months: Array<{ month: string; items: Filing[] }> = []
  for (const filing of visible) {
    const month = filing.date.slice(0, 7)
    const last = months[months.length - 1]
    if (last?.month === month) last.items.push(filing)
    else months.push({ month, items: [filing] })
  }

  return (
    <div className={styles.filings} data-event-documents="">
      {counts.size > 1 ? (
        <div className={styles.chips} role="group" aria-label="Kinds of filing shown">
          <FilterChip label="All" active={group === 'all'} onClick={() => setGroup('all')} trailing={<span className={styles.count}>{filings.length}</span>} />
          {GROUPS.filter((key) => counts.get(key)).map((key) => (
            <FilterChip
              key={key}
              label={FILING_GROUP_LABEL[key]}
              active={group === key}
              onClick={() => setGroup(group === key ? 'all' : key)}
              trailing={<span className={styles.count}>{counts.get(key)}</span>}
            />
          ))}
        </div>
      ) : null}
      {months.map(({ month, items }) => (
        <section key={month} className={styles.month} aria-label={monthLabel(month)}>
          <h3 className={styles.monthLabel}>{monthLabel(month)}</h3>
          <ol className={styles.list}>
            {items.map((filing) => (
              <li key={filing.key} data-group={filing.group}>
                <a href={filing.url} target="_blank" rel="noreferrer" className={styles.row}>
                  <time dateTime={filing.date}>{dayLabel(filing.date)}</time>
                  <span className={styles.what}>
                    <strong>{filing.label}</strong>
                    {filing.detail ? <span className={styles.detail}>{filing.detail}</span> : null}
                  </span>
                  {filing.code ? <span className={styles.code}>{filing.code}</span> : null}
                  <span className={styles.open} aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {shown.length > FIRST ? (
        <button type="button" className={styles.more} onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          {expanded ? 'Show fewer' : `Show all ${shown.length}`}
        </button>
      ) : null}
    </div>
  )
}
