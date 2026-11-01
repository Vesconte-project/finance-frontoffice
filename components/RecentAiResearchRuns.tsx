import Link from 'next/link'
import type { AiResearchRun } from '@/lib/ai-research'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type RecentAiResearchRunsProps = {
  title: string
  runs: AiResearchRun[]
  emptyMessage: string
  compact?: boolean
  className?: string
}

function formatDateTime(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Recent'
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusVariant(status: AiResearchRun['status']): 'success' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function excerptText(run: AiResearchRun): string {
  if (run.responseExcerpt) return run.responseExcerpt
  if (run.errorMessage) return run.errorMessage
  return 'Run created. Waiting for final response content.'
}

function questionText(run: AiResearchRun): string {
  return run.promptLabel ?? run.question ?? 'Untitled AI research run'
}

function buildRerunHref(run: AiResearchRun): string {
  const params = new URLSearchParams()
  const question = run.question ?? run.promptLabel ?? ''
  if (question) params.set('aiQuestion', question)
  if (run.promptLabel) params.set('aiPromptLabel', run.promptLabel)
  const query = params.toString()
  return query.length > 0 ? `/stocks/${run.ticker}?${query}` : `/stocks/${run.ticker}`
}

export default function RecentAiResearchRuns({
  title,
  runs,
  emptyMessage,
  compact = false,
  className,
}: RecentAiResearchRunsProps) {
  return (
    <Card padding="none" className={cn('overflow-hidden', className)}>
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-card-title text-content-primary">{title}</h3>
      </div>

      {runs.length === 0 ? (
        <div className="px-5 py-5 text-body">{emptyMessage}</div>
      ) : (
        <div className="divide-y divide-border">
          {runs.map((run) => (
            <div key={run.id} className="state-interactive px-5 py-4 hover:bg-surface-hover/60">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link prefetch={false} href={`/stocks/${run.ticker}`} className="text-label-lg numeric-tabular text-accent-text hover:underline">
                      {run.ticker}
                    </Link>
                    <Badge variant={statusVariant(run.status)}>{run.status.toUpperCase()}</Badge>
                  </div>
                  <div className="mt-2 text-body-sm font-semibold leading-snug text-content-primary">
                    {questionText(run)}
                  </div>
                </div>
                <div className="shrink-0 text-caption numeric-tabular text-content-muted">
                  {formatDateTime(run.createdAt)}
                </div>
              </div>

              <div className={`mt-3 text-body-sm leading-6 text-content-secondary ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
                {excerptText(run)}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-caption numeric-tabular text-content-muted">
                {run.signalDate ? <span>Signal date {run.signalDate}</span> : null}
                {run.predictionHorizon !== null ? <span>{run.predictionHorizon}d horizon</span> : null}
                {run.citations.length > 0 ? <span>{run.citations.length} sources</span> : null}
                {run.provider ? <span>{run.provider}</span> : null}
              </div>

              <div className="mt-3 flex items-center gap-3 text-label-sm">
                <Link href={`/dashboard/research/${run.id}`} className="text-accent-text hover:underline">
                  View Run
                </Link>
                <Link href={buildRerunHref(run)} className="text-content-secondary hover:text-accent-text">
                  Re-run Prompt
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
