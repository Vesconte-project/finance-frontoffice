import { emptyReasonText, lineName, sourceName, type EmptyPeriod, type SeriesOrigin } from '@/lib/statement-reading'
import styles from './ValueOrigin.module.css'

/** "2018 and 2019", "2017, 2018 and 2019". */
function yearList(years: readonly number[]): string {
  const names = years.map(String)
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** One sentence per reason: "No figure for 2018 and 2019: …". */
function emptyLines(empty: readonly EmptyPeriod[]): Array<{ reason: string; text: string }> {
  const byReason = new Map<string, number[]>()
  for (const period of empty) {
    const years = byReason.get(period.reason)
    if (years) years.push(period.year)
    else byReason.set(period.reason, [period.year])
  }
  return [...byReason.entries()].map(([reason, years]) => ({
    reason,
    text: `No figure for ${yearList(years)}: ${emptyReasonText(reason)}.`,
  }))
}

/**
 * Where a chapter's figures come from (spec "Definições próprias das rubricas
 * V1", section 4): the filing, the reported concept, our definition and the
 * lines it adds, as the backend states them. A year published empty is named
 * with its reason, so a gap in a chart is never read as a zero. Nothing here
 * is computed.
 */
export default function ValueOrigin({ subject, origin }: { subject: string; origin: SeriesOrigin | null }) {
  if (!origin || (!origin.latest && origin.empty.length === 0)) return null
  const { latest } = origin
  const empty = emptyLines(origin.empty)
  return (
    <details className={styles.origin} data-value-origin="">
      <summary className={styles.summary}>Where {subject} comes from</summary>
      <div className={styles.body}>
        {latest ? (
          <dl className={styles.facts}>
            {sourceName(latest.source) ? (
              <div>
                <dt>Source</dt>
                <dd>{sourceName(latest.source)}</dd>
              </div>
            ) : null}
            {latest.accession ? (
              <div>
                <dt>Filing</dt>
                <dd><code data-accession="">{latest.accession}</code> (SEC accession number)</dd>
              </div>
            ) : null}
            {latest.composition.length > 0 ? (
              <div>
                <dt>Our definition</dt>
                <dd>
                  The sum of these lines, all from that one filing:
                  <ul className={styles.parts} data-composition="">
                    {latest.composition.map((part) => (
                      <li key={part.lineItemId}>
                        {lineName(part.lineItemId)}
                        {part.concept ? <> <code>{part.concept}</code></> : null}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : latest.concept ? (
              <div>
                <dt>Reported as</dt>
                <dd><code data-concept="">{latest.concept}</code>, as the company reports it</dd>
              </div>
            ) : null}
            {latest.definitionId ? (
              <div>
                <dt>Definition</dt>
                <dd><code data-definition="">{latest.definitionId}</code>: every year shown uses this one definition</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {latest ? <p className={styles.scope}>For fiscal {latest.year}, the latest figure.</p> : null}
        {empty.map((line) => (
          <p key={line.reason} className={styles.empty} data-empty-reason={line.reason}>{line.text}</p>
        ))}
      </div>
    </details>
  )
}
