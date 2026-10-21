import Link from 'next/link'
import type { AlertItem } from '@/lib/model-lab/contract'
import { CheckMark, Section } from './ui'

export function alertHref(a: AlertItem): string {
  return a.kind === 'panel' ? `/models/panels/${a.sourceId}` : `/models/theses/${a.sourceId}${a.title.startsWith('Checks that hold') ? '?tab=watching' : ''}`
}

export default function AlertsFeed({ alerts }: { alerts: readonly AlertItem[] }) {
  const top = alerts.slice(0, 4)
  if (!top.length) return null
  return (
    <Section title="Since you last looked" aside={<Link href="/models/alerts" className="text-[var(--color-accent)] underline underline-offset-2">All alerts</Link>}>
      <ul className="divide-y divide-[var(--line)]">
        {top.map((a) => (
          <li key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <CheckMark state={a.tone === 'ok' ? 'holds' : a.tone === 'warn' ? 'partly' : 'fails'} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-medium text-content-primary">{a.title}</p>
              <p className="text-body-sm text-content-muted">{a.why}</p>
            </div>
            <Link href={alertHref(a)} className="shrink-0 text-label-sm text-[var(--color-accent)] underline underline-offset-2">Open</Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
