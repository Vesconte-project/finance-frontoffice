import Link from 'next/link'
import Card from '@/components/ui/Card'
import { PICK_DISCLOSURE } from '@/lib/picks-content'

/**
 * Who made this ranking, what it rests on, when, and what it is not.
 *
 * Rendered on every ranking page, signed in or out, because the obligation attaches to
 * publishing the ranking rather than to who is reading it. The copy lives in
 * `PICK_DISCLOSURE` so every ranking surface says the same thing.
 */
export default function PickDisclosure({ asOfLabel }: { asOfLabel: string | null }) {
  const rows = [
    { term: 'Who', detail: PICK_DISCLOSURE.producer },
    { term: 'What it is', detail: PICK_DISCLOSURE.general },
    {
      term: 'Basis',
      detail: asOfLabel ? `${PICK_DISCLOSURE.basis} Data as of ${asOfLabel}.` : PICK_DISCLOSURE.basis,
    },
    { term: 'Risk', detail: PICK_DISCLOSURE.risk },
  ]

  return (
    <Card tone="quiet" className="rounded-[var(--radius-2xl)]" data-pick-disclosure="">
      <h2 className="text-card-title text-content-primary">About this ranking</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.term}>
            <dt className="text-label-sm font-semibold text-content-primary">{row.term}</dt>
            <dd className="text-caption mt-0.5 leading-relaxed text-content-muted">{row.detail}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption mt-4 text-content-muted">
        <Link href="/product#methodology" className="underline underline-offset-2 hover:text-content-primary">
          Read the full methodology
        </Link>
      </p>
    </Card>
  )
}
