import Link from 'next/link'
import { PICK_DISCLOSURE } from '@/lib/picks-content'
import styles from './Rankings.module.css'

/**
 * Who made this ranking, what it rests on, when, and what it is not.
 *
 * Rendered wherever a ranking is, signed in or out, because the obligation attaches
 * to publishing the ranking rather than to who is reading it. The essentials are one
 * line; the full statement opens in place and is in the document either way.
 */
export default function PickDisclosure({ asOfLabel }: { asOfLabel: string | null }) {
  const rows = [
    { term: 'Who', detail: PICK_DISCLOSURE.producer },
    { term: 'What it is', detail: PICK_DISCLOSURE.general },
    {
      term: 'Basis',
      detail: asOfLabel ? `${PICK_DISCLOSURE.basis} Data as of ${asOfLabel}.` : PICK_DISCLOSURE.basis,
    },
    { term: 'Conflicts of interest', detail: PICK_DISCLOSURE.conflicts },
    { term: 'Risk', detail: PICK_DISCLOSURE.risk },
  ]

  return (
    <section className={styles.disclosure} aria-label="About this ranking" data-pick-disclosure="">
      <p className={styles.disclosureLine}>
        <strong>General ranking, not personal advice.</strong> Prepared automatically by Vesconte
        {asOfLabel ? ` from data as of ${asOfLabel}` : ''}. No conflicts of interest. Shares can lose value.
      </p>
      <details className={styles.fold}>
        <summary>Full disclosure</summary>
        <div className={styles.foldBody}>
          <dl className={styles.disclosureList}>
            {rows.map((row) => (
              <div key={row.term}>
                <dt>{row.term}</dt>
                <dd>{row.detail}</dd>
              </div>
            ))}
          </dl>
          <p>
            <Link href="/product#methodology" className={styles.inlineLink}>
              Read the full methodology
            </Link>
          </p>
        </div>
      </details>
    </section>
  )
}
