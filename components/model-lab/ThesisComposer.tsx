'use client'

import { useId, useState } from 'react'
import Card from '@/components/ui/Card'
import ValueTrack from '@/components/model-lab/ValueTrack'
import { cn } from '@/lib/utils'
import {
  BENCHMARK_OPTIONS,
  CONDITION_OPTIONS,
  DEFAULT_SENTENCE,
  DOES_OPTIONS,
  GAIN_TRACK,
  HORIZON_TRACK,
  LOSS_TRACK,
  UNIVERSE_OPTIONS,
  WHO_OPTIONS,
  countVariants,
  describeThesis,
  doesNeedsBenchmark,
  horizonText,
  horizonsText,
  optionText,
  percentText,
  type Option,
  type ThesisSentence,
} from '@/lib/model-lab/thesis-sentence'
import type { TrackSpec } from '@/lib/model-lab/value-track'

type ListSlot = 'who' | 'universe' | 'does' | 'benchmark' | 'condition'
type TrackSlot = 'horizons' | 'gains' | 'losses'
type Slot = ListSlot | TrackSlot

const LIST_OPTIONS: Readonly<Record<ListSlot, readonly Option<string>[]>> = {
  who: WHO_OPTIONS,
  universe: UNIVERSE_OPTIONS,
  does: DOES_OPTIONS,
  benchmark: BENCHMARK_OPTIONS,
  condition: CONDITION_OPTIONS,
}

const LIST_TITLES: Readonly<Record<ListSlot, string>> = {
  who: 'Which kind of stock',
  universe: 'Which stocks',
  does: 'What you expect',
  benchmark: 'Compared with',
  condition: 'When',
}

type TrackConfig = Readonly<{
  spec: TrackSpec
  title: string
  unit: string
  format: (value: number) => string
}>

const TRACKS: Readonly<Record<TrackSlot, TrackConfig>> = {
  horizons: { spec: HORIZON_TRACK, title: 'Over how long', unit: 'days', format: horizonText },
  gains: { spec: GAIN_TRACK, title: 'Target gain', unit: '%', format: (v) => percentText(v, '+') },
  losses: { spec: LOSS_TRACK, title: 'Stop-loss', unit: '%', format: (v) => percentText(v, '−') },
}

function isTrackSlot(slot: Slot): slot is TrackSlot {
  return slot === 'horizons' || slot === 'gains' || slot === 'losses'
}

type TokenProps = {
  slot: Slot
  open: Slot | null
  panelId: string
  onToggle: (slot: Slot) => void
  children: React.ReactNode
}

function Token({ slot, open, panelId, onToggle, children }: TokenProps) {
  const expanded = open === slot
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={expanded ? panelId : undefined}
      onClick={() => onToggle(slot)}
      className={cn(
        'mx-0.5 inline cursor-pointer rounded-sm border-b-2 px-1 py-0.5 text-left text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
        expanded ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)]'
      )}
    >
      {children}
    </button>
  )
}

function valuesText(values: readonly number[], sign: '+' | '−'): string {
  return values.map((v) => percentText(v, sign)).join(', ')
}

export default function ThesisComposer() {
  const [sentence, setSentence] = useState<ThesisSentence>(DEFAULT_SENTENCE)
  const [open, setOpen] = useState<Slot | null>(null)
  const [several, setSeveral] = useState<Readonly<Record<TrackSlot, boolean>>>({
    horizons: false,
    gains: false,
    losses: false,
  })
  const panelId = useId()
  const switchId = useId()

  const variants = countVariants(sentence)
  const barrier = sentence.does === 'barrier'
  const needsBenchmark = doesNeedsBenchmark(sentence.does)

  function toggle(slot: Slot) {
    setOpen((current) => (current === slot ? null : slot))
  }

  function choose(slot: ListSlot, key: string) {
    setSentence((current) => ({ ...current, [slot]: key }) as ThesisSentence)
    setOpen(null)
  }

  function setValues(slot: TrackSlot, values: number[]) {
    setSentence((current) => ({ ...current, [slot]: values }))
  }

  function setSeveralFor(slot: TrackSlot, on: boolean) {
    setSeveral((current) => ({ ...current, [slot]: on }))
    if (!on) setSentence((current) => ({ ...current, [slot]: current[slot].slice(0, 1) }))
  }

  const trackOpen = open !== null && isTrackSlot(open) ? open : null
  const listOpen = open !== null && !isTrackSlot(open) ? open : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-4">
        <Card padding="lg">
          <p className="font-[var(--font-display)] text-[1.35rem] leading-[2.1] text-content-primary sm:text-[1.6rem]">
            I think{' '}
            <Token slot="who" open={open} panelId={panelId} onToggle={toggle}>
              {optionText(WHO_OPTIONS, sentence.who)}
            </Token>{' '}
            among{' '}
            <Token slot="universe" open={open} panelId={panelId} onToggle={toggle}>
              {optionText(UNIVERSE_OPTIONS, sentence.universe)}
            </Token>{' '}
            will{' '}
            {barrier ? (
              <>
                <Token slot="does" open={open} panelId={panelId} onToggle={toggle}>
                  reach a gain of
                </Token>{' '}
                <Token slot="gains" open={open} panelId={panelId} onToggle={toggle}>
                  {valuesText(sentence.gains, '+')}
                </Token>{' '}
                before a loss of{' '}
                <Token slot="losses" open={open} panelId={panelId} onToggle={toggle}>
                  {valuesText(sentence.losses, '−')}
                </Token>
              </>
            ) : (
              <>
                <Token slot="does" open={open} panelId={panelId} onToggle={toggle}>
                  {optionText(DOES_OPTIONS, sentence.does)}
                </Token>
                {needsBenchmark ? (
                  <>
                    {' '}
                    <Token slot="benchmark" open={open} panelId={panelId} onToggle={toggle}>
                      {optionText(BENCHMARK_OPTIONS, sentence.benchmark)}
                    </Token>
                  </>
                ) : null}
              </>
            )}{' '}
            <Token slot="condition" open={open} panelId={panelId} onToggle={toggle}>
              {optionText(CONDITION_OPTIONS, sentence.condition)}
            </Token>{' '}
            over{' '}
            <Token slot="horizons" open={open} panelId={panelId} onToggle={toggle}>
              {horizonsText(sentence.horizons)}
            </Token>
            .
          </p>
          <p className="mt-3 text-body-sm text-content-muted">
            {listOpen === null && trackOpen === null
              ? 'Every underlined phrase is a choice. Select one to change it.'
              : 'Pick a value, or select the phrase again to close.'}
          </p>
        </Card>

        {listOpen !== null ? (
          <Card id={panelId} role="group" aria-label={LIST_TITLES[listOpen]} padding="md">
            <h2 className="text-card-title text-content-primary">{LIST_TITLES[listOpen]}</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {LIST_OPTIONS[listOpen].map((option) => {
                const selected = sentence[listOpen] === option.key
                return (
                  <li key={option.key}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => choose(listOpen, option.key)}
                      className={cn(
                        'flex min-h-11 w-full cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                        selected
                          ? 'border-[var(--accent)] bg-[var(--surface-soft)]'
                          : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]'
                      )}
                    >
                      <span className="text-sm font-medium text-content-primary">{option.text}</span>
                      <span className="text-caption text-content-muted">{option.hint}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        ) : null}

        {trackOpen !== null ? (
          <Card id={panelId} role="group" aria-label={TRACKS[trackOpen].title} padding="md">
            <h2 className="text-card-title text-content-primary">{TRACKS[trackOpen].title}</h2>
            <div className="mt-2">
              <ValueTrack
                label={TRACKS[trackOpen].title}
                spec={TRACKS[trackOpen].spec}
                values={sentence[trackOpen]}
                onChange={(values) => setValues(trackOpen, values)}
                format={TRACKS[trackOpen].format}
                multi={several[trackOpen] || sentence[trackOpen].length > 1}
                unit={TRACKS[trackOpen].unit}
              />
            </div>
            <label htmlFor={switchId} className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-content-primary">
              <input
                id={switchId}
                type="checkbox"
                checked={several[trackOpen] || sentence[trackOpen].length > 1}
                onChange={(event) => setSeveralFor(trackOpen, event.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              />
              Compare several values
            </label>
          </Card>
        ) : null}
      </div>

      <aside aria-label="Your test" className="lg:sticky lg:top-24 lg:self-start">
        <Card padding="md">
          <h2 className="text-card-title text-content-primary">Your test</h2>
          <p className="mt-2 font-[var(--font-display)] text-base leading-snug text-content-primary" aria-live="polite">
            {describeThesis(sentence)}.
          </p>
          <p className="mt-3 text-body-sm text-content-muted">
            {variants === 1
              ? 'One test.'
              : `${variants} tests: every combination of the values you are comparing.`}
          </p>
          <p className="mt-3 border-t border-[var(--line)] pt-3 text-caption text-content-muted">
            This page only builds the sentence. Nothing is run or saved yet.
          </p>
        </Card>
      </aside>
    </div>
  )
}
