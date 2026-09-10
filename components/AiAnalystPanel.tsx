'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Lock, Sparkles } from 'lucide-react'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import FilterChip from '@/components/ui/FilterChip'
import { buttonClass } from '@/components/ui/Button'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'
import { trackEvent, trackFeature } from '@/lib/analytics'
import { cn } from '@/lib/utils'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'

type PromptPreset = {
  id: string
  label: string
  prompt: string
}

type AiAnalystPanelProps = {
  ticker: string
  signal: {
    direction: SignalDirection
    conviction: number | null
    predictionHorizon: number | null
    signalDate: string
  }
  news: Array<{
    title: string
    publisher: string
    publishedAt: string | null
    url: string
  }>
  isPro: boolean
  providerEnabled: boolean
  upgradeHref: string | null
  initialQuestion?: string | null
  initialPromptLabel?: string | null
  compact?: boolean
}

const PROMPT_PRESETS: PromptPreset[] = [
  {
    id: 'drivers',
    label: 'Revenue and earnings drivers',
    prompt: 'What are the main drivers behind revenue and earnings performance?',
  },
  {
    id: 'signal',
    label: 'Reason for current model stance',
    prompt: 'Why did the model flip into its current stance?',
  },
  {
    id: 'risk',
    label: 'Near-term invalidation risks',
    prompt: 'What risks could invalidate this setup over the next few weeks?',
  },
]

function mergeUniqueUrls(existing: string[], incoming: unknown): string[] {
  const next = new Set(existing)
  if (Array.isArray(incoming)) {
    for (const item of incoming) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (!trimmed.startsWith('http')) continue
      next.add(trimmed)
    }
  }
  return [...next]
}

function summarizeSignal(signal: AiAnalystPanelProps['signal']): string {
  const conviction =
    signal.conviction === null ? 'unknown conviction' : `${Math.round(signal.conviction * 100)}% conviction`
  const horizon =
    signal.predictionHorizon === null ? 'unknown horizon' : `${signal.predictionHorizon}d horizon`
  return `${signal.direction.toUpperCase()} · ${conviction} · ${horizon}`
}

function signalVariant(direction: SignalDirection): 'success' | 'danger' | 'neutral' {
  if (direction === 'bullish') return 'success'
  if (direction === 'bearish') return 'danger'
  return 'neutral'
}

function LockedState({
  ticker,
  upgradeHref,
  compact = false,
}: {
  ticker: string
  upgradeHref: string | null
  compact?: boolean
}) {
  const href = upgradeHref ?? '/pricing'
  const openUpgradeInNewTab = href.startsWith('http')

  return (
    <Card className={compact ? 'space-y-4' : 'space-y-6'}>
      <TrackEventOnMount
        eventName="upgrade_prompt_shown"
        payload={{ control: 'ai_analyst_locked', surface: 'ai_analyst_panel', ticker: ticker.toUpperCase() }}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-filter-label">AI Analyst</div>
          <h3 className="mt-1 text-heading-sm text-content-primary">{ticker} research copilot</h3>
        </div>
        <Badge variant="warning">
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
            Pro
          </span>
        </Badge>
      </div>
      <p className="text-body-md text-content-secondary">
        Ask deeper questions about catalysts, risk scenarios, and stance shifts. Upgrade to run unlimited AI research prompts.
      </p>
      <a
        href={href}
        data-analytics-id="ai_analyst_upgrade"
        data-analytics-ticker={ticker.toUpperCase()}
        target={openUpgradeInNewTab ? '_blank' : undefined}
        rel={openUpgradeInNewTab ? 'noopener noreferrer' : undefined}
        className={cn(buttonClass({ variant: 'secondary' }), compact ? 'h-8 px-3 text-[12px]' : undefined)}
      >
        Upgrade to Pro
      </a>
    </Card>
  )
}

function UnavailableState({ compact = false }: { compact?: boolean }) {
  return (
    <Card className={compact ? 'space-y-4' : 'space-y-6'}>
      <TrackEventOnMount
        eventName="unavailable_shown"
        payload={{ control: 'ai_analyst_provider', surface: 'ai_analyst_panel' }}
      />
      <div className="text-filter-label">AI Analyst</div>
      <h3 className="text-heading-sm text-content-primary">Provider not enabled</h3>
      <p className="text-body-md text-content-secondary">
        The AI panel is available, but the server provider key is missing. Add provider credentials to enable live responses.
      </p>
    </Card>
  )
}

export default function AiAnalystPanel({
  ticker,
  signal,
  news,
  isPro,
  providerEnabled,
  upgradeHref,
  initialQuestion = null,
  initialPromptLabel = null,
  compact = false,
}: AiAnalystPanelProps) {
  const [analysis, setAnalysis] = useState('')
  const [citations, setCitations] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPromptId, setSelectedPromptId] = useState<string>(PROMPT_PRESETS[0].id)
  const [customQuestion, setCustomQuestion] = useState('')
  const questionRef = useRef<HTMLTextAreaElement | null>(null)

  const signalSummary = useMemo(() => summarizeSignal(signal), [signal])
  const selectedPrompt = PROMPT_PRESETS.find((preset) => preset.id === selectedPromptId) ?? PROMPT_PRESETS[0]

  useEffect(() => {
    if (initialQuestion) setCustomQuestion(initialQuestion)
  }, [initialQuestion])

  useEffect(() => {
    if (!initialPromptLabel) return
    const matched = PROMPT_PRESETS.find((preset) =>
      preset.label.toLowerCase() === initialPromptLabel.toLowerCase()
    )
    if (matched) setSelectedPromptId(matched.id)
  }, [initialPromptLabel])

  useEffect(() => {
    const textarea = questionRef.current
    if (!textarea) return
    textarea.style.height = compact ? '80px' : '88px'
    textarea.style.height = `${Math.max(textarea.scrollHeight, compact ? 80 : 88)}px`
  }, [compact, customQuestion])

  const runAnalysis = async (question: string) => {
    setPending(true)
    setError(null)
    setAnalysis('')
    setCitations([])

    const startedAt = Date.now()
    trackFeature('ai_analyst_run', {
      ticker: ticker.toUpperCase(),
      prompt: selectedPrompt.label,
      question_length: question.length,
      custom: question !== selectedPrompt.prompt,
      compact,
    })

    try {
      const response = await fetch('/api/ai-analyst', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticker,
          signal,
          news,
          question,
          promptLabel: selectedPrompt.label,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string; details?: string } | null
        throw new Error(payload?.details || payload?.error || 'AI analysis request failed.')
      }

      if (!response.body) {
        throw new Error('AI analysis stream is unavailable.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accumulated = ''
      let gatheredCitations: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split(/\r?\n\r?\n/)
        buffer = events.pop() || ''

        for (const eventBlock of events) {
          const lines = eventBlock
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.startsWith('data:'))

          for (const line of lines) {
            const payload = line.slice(5).trim()
            if (!payload || payload === '[DONE]') continue

            let parsed: Record<string, unknown>
            try {
              parsed = JSON.parse(payload) as Record<string, unknown>
            } catch {
              continue
            }

            const choices = Array.isArray(parsed.choices) ? parsed.choices : []
            const firstChoice = (choices[0] as Record<string, unknown> | undefined) ?? null
            const delta = (firstChoice?.delta as Record<string, unknown> | undefined) ?? null
            const message = (firstChoice?.message as Record<string, unknown> | undefined) ?? null

            const deltaContent = typeof delta?.content === 'string' ? delta.content : null
            const messageContent = typeof message?.content === 'string' ? message.content : null
            const contentChunk = deltaContent ?? (accumulated.length === 0 ? messageContent : null)

            if (contentChunk && contentChunk.length > 0) {
              accumulated += contentChunk
              setAnalysis(accumulated)
            }

            gatheredCitations = mergeUniqueUrls(gatheredCitations, parsed.citations)
            if (gatheredCitations.length > 0) setCitations(gatheredCitations)
          }
        }
      }

      if (accumulated.trim().length === 0) {
        throw new Error('No analysis content was returned.')
      }

      trackFeature('ai_analyst_complete', {
        ticker: ticker.toUpperCase(),
        prompt: selectedPrompt.label,
        duration_ms: Date.now() - startedAt,
        answer_length: accumulated.length,
        citation_count: gatheredCitations.length,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI analysis.')
      trackEvent('error_shown', {
        control: 'ai_analyst',
        surface: 'ai_analyst_panel',
        ticker: ticker.toUpperCase(),
        message: err instanceof Error ? err.message : 'unknown',
      })
    } finally {
      setPending(false)
    }
  }

  if (!isPro) return <LockedState ticker={ticker} upgradeHref={upgradeHref} compact={compact} />
  if (!providerEnabled) return <UnavailableState compact={compact} />

  return (
    <Card className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-filter-label">AI Analyst</div>
          <h3 className="mt-1 text-heading-sm text-content-primary">{ticker} research copilot</h3>
          <p className="mt-1 text-body-sm text-content-secondary numeric-tabular">{signalSummary}</p>
        </div>
        <Badge variant={signalVariant(signal.direction)}>{signal.direction.toUpperCase()}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_PRESETS.map((preset) => (
          <FilterChip
            key={preset.id}
            analyticsId={`ai_analyst_prompt:${preset.id}`}
            label={preset.label}
            active={preset.id === selectedPromptId}
            onClick={() => setSelectedPromptId(preset.id)}
            className={compact ? 'h-7 rounded-[6px] px-2.5 text-[12px]' : undefined}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <textarea
          ref={questionRef}
          value={customQuestion}
          onChange={(event) => setCustomQuestion(event.target.value)}
          placeholder="Ask a follow-up question..."
          rows={compact ? 3 : 4}
          className={cn(
            'w-full resize-none overflow-hidden rounded-[var(--radius-md)] border border-input bg-surface-card px-3 py-2.5 text-[13px] text-content-primary outline-none placeholder:text-content-muted focus-visible:border-primary/55 focus-visible:ring-2 focus-visible:ring-primary/30',
            compact ? 'min-h-[80px]' : 'min-h-[88px]'
          )}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-analytics-id="ai_analyst_run_custom"
            disabled={pending || customQuestion.trim().length === 0}
            onClick={() => runAnalysis(customQuestion.trim())}
            className={cn(buttonClass({ variant: 'primary' }), compact ? 'h-8 px-3 text-[12px]' : undefined)}
          >
            {pending ? 'Running...' : 'Run'}
          </button>
          <button
            type="button"
            data-analytics-id="ai_analyst_run_preset"
            onClick={() => runAnalysis(selectedPrompt.prompt)}
            disabled={pending}
            className={cn(buttonClass({ variant: 'secondary' }), compact ? 'h-8 px-3 text-[12px]' : undefined)}
          >
            <span className="inline-flex items-center gap-2">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Run selected prompt
            </span>
          </button>
        </div>
      </div>

      <div className={cn('surface-tertiary rounded-[var(--radius-lg)] p-4 md:p-5', compact ? 'md:p-4' : undefined)}>
        {error ? (
          <p className="text-body-sm signal-bearish">{error}</p>
        ) : (
          <pre className={cn('whitespace-pre-wrap text-body-sm leading-6 text-content-secondary', compact ? 'min-h-[120px]' : 'min-h-[140px]')}>
            {analysis || (pending ? 'Running live synthesis...' : 'Run a prompt to generate AI analysis.')}
          </pre>
        )}
      </div>

      {citations.length > 0 ? (
        <div className="surface-secondary rounded-[var(--radius-lg)] p-4">
          <div className="text-filter-label mb-2">Sources</div>
          <div className="space-y-1.5">
            {citations.slice(0, 5).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="state-interactive block truncate text-body-sm text-accent-text hover:underline"
              >
                {url}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  )
}
