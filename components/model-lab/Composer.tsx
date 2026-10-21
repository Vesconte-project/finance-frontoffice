'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import ParamEditor from '@/components/model-lab/ParamEditor'
import SentenceBuilder from '@/components/model-lab/SentenceBuilder'
import StockPicker from '@/components/model-lab/StockPicker'
import { Note, Section } from '@/components/model-lab/ui'
import { cn } from '@/lib/utils'
import type { Draft, ParamValue, Quote, Rigor, Run, Unit } from '@/lib/model-lab/contract'
import { describeError, labFetch, newIdempotencyKey } from '@/lib/model-lab/client'
import {
  FAMILIES,
  LAYERS,
  defaultValues,
  shownParams,
  type Depth,
  type Layer,
} from '@/lib/model-lab/params'
import { describeThesis, optionText, UNIVERSE_OPTIONS, type ThesisSentence } from '@/lib/model-lab/thesis-sentence'

/** Settings the sentence already decides; the sections below never repeat them. */
const SENTENCE_IDS = new Set(['horizon', 'label', 'gain', 'loss', 'regime', 'bench'])
const LAYER_ORDER: readonly Layer[] = ['data', 'model', 'signal', 'backtest']
const RIGOR: readonly { key: Rigor; name: string; hint: string }[] = [
  { key: 'quick', name: 'Quick', hint: 'Fewer checks. Cheapest, and a rougher answer.' },
  { key: 'standard', name: 'Standard', hint: 'The usual set of checks.' },
  { key: 'thorough', name: 'Thorough', hint: 'More periods and more checks. Costs the most.' },
]
const QUOTE_DELAY_MS = 400

export type ComposerInitial = Readonly<{
  sentence: ThesisSentence
  assets: readonly string[]
  thesisId: string | null
  /** The earlier test whose trained model is reused; model settings are then fixed. */
  reuse: Readonly<{ testId: string }> | null
  mode: 'new' | 'again' | 'edit'
}>

type ComposerProps = {
  initial: ComposerInitial
  depth: Depth
  isTeam: boolean
}

function amountText(amount: number, unit: Unit): string {
  const rounded = amount < 10 ? amount.toFixed(1) : String(Math.round(amount))
  return `${rounded} ${rounded === '1.0' || rounded === '1' ? unit.one : unit.many}`
}

export default function Composer({ initial, depth, isTeam }: ComposerProps) {
  const router = useRouter()
  const [sentence, setSentence] = useState<ThesisSentence>(initial.sentence)
  const [assets, setAssets] = useState<string[]>([...initial.assets])
  const [rigor, setRigor] = useState<Rigor>('standard')
  const [values, setValues] = useState<Record<string, ParamValue[]>>(() => defaultValues())
  const [several, setSeveral] = useState<ReadonlySet<string>>(new Set())
  const [families, setFamilies] = useState<string[]>([...FAMILIES])
  const [diagnostics, setDiagnostics] = useState({ scout: false, decay: true, robust: true, lookahead: true })
  const [register, setRegister] = useState(false)

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteState, setQuoteState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [quoteError, setQuoteError] = useState('')
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'failed'>('idle')
  const [submitError, setSubmitError] = useState('')
  const keyRef = useRef<{ draft: string; key: string } | null>(null)

  const reuse = initial.reuse

  const draft: Draft = useMemo(
    () => ({
      sentence,
      assets: sentence.universe === 'picks' ? assets : [],
      rigor,
      values: {
        ...values,
        horizon: [...sentence.horizons],
        label: [sentence.does],
        gain: [...sentence.gains],
        loss: [...sentence.losses],
        regime: [sentence.condition],
        bench: [sentence.benchmark],
      },
      families,
      diagnostics,
      reuseTestId: reuse?.testId ?? null,
      thesisId: initial.mode === 'new' ? null : initial.thesisId,
      registerCandidate: isTeam && depth === 'lab' && register,
    }),
    [sentence, assets, rigor, values, families, diagnostics, reuse, initial.mode, initial.thesisId, isTeam, depth, register]
  )
  const draftJson = JSON.stringify(draft)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setQuoteState('loading')
      labFetch<Quote>('quotes', { method: 'POST', body: JSON.parse(draftJson) as Draft, signal: controller.signal })
        .then((next) => {
          setQuote(next)
          setQuoteState('ready')
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setQuoteError(describeError(error))
          setQuoteState('failed')
        })
    }, QUOTE_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [draftJson])

  function setParam(id: string, next: ParamValue[]) {
    setValues((current) => ({ ...current, [id]: next }))
  }

  function setSeveralFor(id: string, on: boolean) {
    setSeveral((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function applyFix(key: string) {
    if (key === 'dropGrowth') setFamilies((current) => current.filter((f) => f !== 'Growth'))
    else if (key === 'moreHistory') setParam('history', [5])
    else if (key === 'quick') setRigor('quick')
  }

  async function submit() {
    if (!quote || quoteState !== 'ready' || quote.findings.some((f) => f.severity === 'block')) return
    if (!keyRef.current || keyRef.current.draft !== draftJson) keyRef.current = { draft: draftJson, key: newIdempotencyKey() }
    setSubmitState('sending')
    try {
      const run = await labFetch<Run>('runs', { method: 'POST', body: draft, idempotencyKey: keyRef.current.key })
      router.push(`/models/runs/${run.id}`)
    } catch (error) {
      setSubmitError(describeError(error))
      setSubmitState('failed')
    }
  }

  const blocked = quote?.findings.some((f) => f.severity === 'block') ?? false
  const canSubmit = quoteState === 'ready' && quote !== null && !blocked && submitState !== 'sending'
  const title = initial.mode === 'edit' ? 'Edit thesis' : initial.mode === 'again' ? 'Test again' : 'Test a new thesis'

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-8">
        <h1 className="text-page-title text-content-primary">{title}</h1>

        <Section title="Your thesis">
          {reuse ? (
            <Card padding="lg">
              <p className="font-[var(--font-display)] text-[1.35rem] leading-snug text-content-primary">{describeThesis(sentence)}.</p>
              <p className="mt-3 text-body-sm text-content-muted">
                This test reuses the model trained earlier, so the thesis and the model settings stay as they were. You can change the rules and the trading assumptions.
              </p>
            </Card>
          ) : (
            <SentenceBuilder sentence={sentence} onChange={setSentence} />
          )}
        </Section>

        {sentence.universe === 'picks' ? (
          <Section title="Your stocks">
            <Card padding="md">
              <StockPicker value={assets} onChange={setAssets} />
            </Card>
          </Section>
        ) : (
          <p className="text-body-sm text-content-muted">Testing on {optionText(UNIVERSE_OPTIONS, sentence.universe)}.</p>
        )}

        <Section title="How careful">
          <ul className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How careful">
            {RIGOR.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={rigor === r.key}
                  onClick={() => setRigor(r.key)}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                    rigor === r.key ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-strong)]'
                  )}
                >
                  <span className="text-sm font-medium text-content-primary">{r.name}</span>
                  <span className="text-caption text-content-muted">{r.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>

        {depth !== 'guided'
          ? LAYER_ORDER.filter((layer) => !(reuse && (layer === 'data' || layer === 'model'))).map((layer) => {
              const params = shownParams(layer, depth, draft.values).filter((p) => !SENTENCE_IDS.has(p.id))
              const showFamilies = layer === 'data'
              if (params.length === 0 && !showFamilies) return null
              return (
                <Section key={layer} title={LAYERS[layer].name} aside={LAYERS[layer].tag}>
                  <Card padding="md">
                    <p className="text-body-sm text-content-muted">{LAYERS[layer].sub}</p>
                    {showFamilies && !reuse ? (
                      <fieldset className="mt-3 border-t border-[var(--line)] pt-4">
                        <legend className="text-card-title text-content-primary">Signal families</legend>
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {FAMILIES.map((family) => {
                            const on = families.includes(family)
                            return (
                              <li key={family}>
                                <button
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => setFamilies((current) => (on ? current.filter((f) => f !== family) : [...current, family]))}
                                  className={cn(
                                    'min-h-11 cursor-pointer rounded-md border px-3 text-sm text-content-primary focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                                    on ? 'border-[var(--accent)] bg-[var(--surface-soft)]' : 'border-[var(--line)] bg-[var(--surface)]'
                                  )}
                                >
                                  {family}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </fieldset>
                    ) : null}
                    {params.map((p) => (
                      <ParamEditor
                        key={p.id}
                        param={p}
                        values={draft.values[p.id] ?? []}
                        several={several.has(p.id)}
                        onChange={(next) => setParam(p.id, next)}
                        onSeveral={(on) => setSeveralFor(p.id, on)}
                      />
                    ))}
                  </Card>
                </Section>
              )
            })
          : null}

        {depth === 'lab' ? (
          <Section title="Extra checks">
            <Card padding="md">
              <ul className="space-y-1">
                {([['scout', 'Scout the signals first'], ['decay', 'Report if the model is fading'], ['robust', 'Robustness checks'], ['lookahead', 'Look-ahead check']] as const).map(([key, label]) => (
                  <li key={key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-content-primary">
                      <input
                        type="checkbox"
                        checked={diagnostics[key]}
                        onChange={(event) => setDiagnostics((current) => ({ ...current, [key]: event.target.checked }))}
                        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                      />
                      {label}
                    </label>
                  </li>
                ))}
                {isTeam ? (
                  <li>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-content-primary">
                      <input type="checkbox" checked={register} onChange={(event) => setRegister(event.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
                      Register the result as a candidate
                    </label>
                  </li>
                ) : null}
              </ul>
            </Card>
          </Section>
        ) : null}
      </div>

      <aside aria-label="Your test" className="lg:sticky lg:top-24 lg:self-start">
        <Card padding="md">
          <h2 className="text-card-title text-content-primary">Your test</h2>
          <p className="mt-2 font-[var(--font-display)] text-base leading-snug text-content-primary" aria-live="polite">
            {describeThesis(sentence)}.
          </p>

          <div className="mt-4 border-t border-[var(--line)] pt-3" aria-live="polite">
            {quoteState === 'failed' ? (
              <Note tone="warn">{quoteError || 'The price could not be worked out.'} Change something to try again.</Note>
            ) : quote ? (
              <div className={cn(quoteState === 'loading' && 'opacity-60')}>
                <p className="text-body-sm text-content-primary">
                  {quote.variants === 1 ? 'One test' : `${quote.variants} tests`}
                  {quote.trainings > 0 ? `, ${quote.trainings} ${quote.trainings === 1 ? 'model' : 'models'} to train` : ', no training'}
                </p>
                <dl className="mt-2 space-y-1 text-body-sm">
                  {quote.lines.map((line) => (
                    <div key={line.label} className="flex justify-between gap-3">
                      <dt className="text-content-muted">{line.label}</dt>
                      <dd className="text-content-primary">{line.amount === 0 ? 'Free' : amountText(line.amount, quote.unit)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-[var(--line)] pt-2 font-medium">
                    <dt className="text-content-primary">Total</dt>
                    <dd className="text-content-primary">{amountText(quote.total, quote.unit)}</dd>
                  </div>
                </dl>
                {quote.naiveTotal - quote.total >= 0.1 ? (
                  <p className="mt-2 text-caption text-content-muted">
                    Reusing work between variants saves {amountText(quote.naiveTotal - quote.total, quote.unit)}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-body-sm text-content-muted" role="status">Working out the price…</p>
            )}
          </div>

          {quote && quote.findings.length > 0 ? (
            <ul className="mt-4 space-y-3" aria-label="Before you run">
              {quote.findings.map((f) => (
                <li key={f.title} className={cn('rounded-md border p-3', f.severity === 'block' ? 'border-[var(--down)]' : 'border-[var(--line-strong)]')}>
                  <p className="text-sm font-medium text-content-primary">
                    <span className="sr-only">{f.severity === 'block' ? 'Must fix: ' : 'Heads up: '}</span>
                    {f.title}
                  </p>
                  <p className="mt-1 text-caption text-content-muted">{f.detail}</p>
                  {f.fix ? (
                    <button type="button" onClick={() => applyFix(f.fix!.key)} className={cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'mt-2')}>
                      {f.fix.label}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <button type="button" onClick={submit} disabled={!canSubmit} className={cn(buttonClass({ size: 'md' }), 'mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50')}>
            {submitState === 'sending' ? 'Starting…' : quote ? `Run test · ${amountText(quote.total, quote.unit)}` : 'Run test'}
          </button>
          {submitState === 'failed' ? (
            <p role="alert" className="mt-2 text-body-sm text-content-primary">
              {submitError} Nothing was charged. <button type="button" onClick={submit} className="underline">Try again</button>
            </p>
          ) : null}
          <p className="mt-3 text-caption text-content-muted">Runs on past data. It does not say what will happen next.</p>
        </Card>
      </aside>
    </div>
  )
}
