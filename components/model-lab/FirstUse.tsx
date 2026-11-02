import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
import { IDEAS } from '@/lib/model-lab/ideas'
import { CheckMark } from './ui'
import { Section } from './ui'

const EXAMPLE = [
  { n: 1, part: 'recent winners', label: 'Which kind of stock' },
  { n: 2, part: 'my 6 stocks', label: 'Which stocks' },
  { n: 3, part: 'outperform the market', label: 'What you expect' },
  { n: 4, part: 'two weeks', label: 'How long' },
] as const

/** What a person sees before they have a thesis: what one is, what comes back, where to start. */
export default function FirstUse({ allowance }: { allowance: string | null }) {
  return (
    <div className="space-y-6">
      <Section title="What is a thesis?">
        <div className="space-y-4 rounded-md border border-dashed border-[var(--line-strong)] p-5">
          <p className="font-[var(--font-display)] text-[1.35rem] leading-[1.7] text-content-primary">
            I think{' '}
            {EXAMPLE.map((e, i) => (
              <span key={e.n}>
                <span className="border-b-2 border-[var(--accent)] pb-px">{e.part}</span>
                <sup className="ml-0.5 text-caption text-[var(--accent)]">{e.n}</sup>
                {i === 0 ? ' among ' : i === 1 ? ' will ' : i === 2 ? ' over ' : '.'}
              </span>
            ))}
          </p>
          <ol className="flex flex-wrap gap-x-5 gap-y-1 text-caption text-content-secondary">
            {EXAMPLE.map((e) => (
              <li key={e.n}>
                <span className="mr-1 text-[var(--accent)]">{e.n}</span>
                {e.label}
              </li>
            ))}
          </ol>
          <p className="text-body-sm text-content-muted">That one sentence is a thesis. We turn it into a test on past data, with trading costs included.</p>
        </div>
      </Section>

      <Section title="What comes back" aside="Example">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {([['holds', 'Still ahead after costs'], ['partly', 'Works in different periods'], ['holds', 'Survives small changes'], ['fails', 'Still working recently'], ['holds', 'Better than the obvious rule']] as const).map(([state, text]) => (
            <li key={text} className="flex items-start gap-2 rounded-md border border-[var(--line)] p-3 text-body-sm text-content-primary">
              <CheckMark state={state} />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-body-sm mt-3 text-content-muted">Five checks, in plain words. The ones that fail tell you what to change. Nothing here says what will happen next.</p>
      </Section>

      <Section title="Or start from an idea">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {IDEAS.map((idea) => (
            <li key={idea.key}>
              <Link href={`/models/new?idea=${idea.key}`} className="block h-full rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 hover:border-[var(--line-strong)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]">
                <span className="block text-card-title text-content-primary">{idea.title}</span>
                <span className="text-body-sm mt-1 block text-content-muted">{idea.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-body-sm mt-3 text-content-muted">Not sure? Pick one, change anything, and the cost is shown before you run it.</p>
        <div className="mt-4">
          <Link href="/models/new" className={buttonClass()}>Test your first thesis</Link>
        </div>
      </Section>
      {allowance ? <p className="text-caption text-content-muted">{allowance}</p> : null}
    </div>
  )
}
