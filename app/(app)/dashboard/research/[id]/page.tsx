import Link from 'next/link'
import { notFound } from 'next/navigation'
import Breadcrumbs from '@/components/Breadcrumbs'
import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/Button'
import RetryButton from '@/components/ui/RetryButton'
import { getViewerUserId } from '@/lib/auth'
import { getAiResearchRunById } from '@/lib/ai-research'
import { PlatformError } from '@/lib/platform-client'

export const dynamic = 'force-dynamic'

function formatDateTime(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Recent'
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function statusTone(status: 'started' | 'completed' | 'failed'): 'success' | 'danger' | 'neutral' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  return 'neutral'
}

function asRunId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) ? value : null
}

function buildRerunHref(ticker: string, question: string | null, promptLabel: string | null): string {
  const params = new URLSearchParams()
  if (question) params.set('aiQuestion', question)
  if (promptLabel) params.set('aiPromptLabel', promptLabel)
  const query = params.toString()
  return query ? `/stocks/${ticker}?${query}` : `/stocks/${ticker}`
}

export default async function AiResearchRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const runId = asRunId(id)
  const userId = await getViewerUserId()

  if (!runId || !userId) notFound()

  let run
  try {
    run = await getAiResearchRunById({ runId })
  } catch (error) {
    if (error instanceof PlatformError && error.status === 404) notFound()
    return (
      <EmptyState
        title="AI research run is temporarily unavailable"
        description="The frontend could not load this saved run from finance-backend."
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <RetryButton>Retry</RetryButton>
            <Link href="/dashboard" className={buttonClass({ variant: 'ghost' })}>
              Return to Today
            </Link>
          </div>
        }
      />
    )
  }
  if (!run) notFound()

  return (
    <div className="section-gap">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Today', href: '/dashboard' },
            { label: 'Research', href: '/dashboard/research' },
            { label: `Run #${run.id}` },
          ]}
        />

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-page-title tracking-tight text-content-primary">
                {run.ticker} AI Research Run
              </h1>
              <Badge variant={statusTone(run.status)}>
                {run.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-body-sm mt-2 text-content-muted">
              Saved on <span className="numeric-tabular">{formatDateTime(run.createdAt)}</span>
            </p>
          </div>

          <Link
            href={buildRerunHref(run.ticker, run.question, run.promptLabel)}
            className={buttonClass({ variant: 'primary' })}
          >
            Re-run This Prompt
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-border bg-surface-elevated px-5 py-4">
                <h2 className="text-card-title text-content-primary">Run Metadata</h2>
              </div>
              <div className="text-body-sm px-5 py-4">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Ticker</span>
                  <span className="text-label-md text-content-primary">{run.ticker}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Prompt</span>
                  <span className="text-label-md text-content-primary text-right max-w-[180px] truncate">
                    {run.promptLabel ?? 'Custom'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Signal Date</span>
                  <span className="text-label-md numeric-tabular text-content-primary">{run.signalDate ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Direction</span>
                  <span className="text-label-md text-content-primary">{run.signalDirection.toUpperCase()}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Conviction</span>
                  <span className="text-label-md numeric-tabular text-content-primary">
                    {run.conviction === null ? '—' : `${Math.round(run.conviction * 100)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Horizon</span>
                  <span className="text-label-md numeric-tabular text-content-primary">
                    {run.predictionHorizon === null ? '—' : `${run.predictionHorizon}d`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-content-muted">Provider</span>
                  <span className="text-label-md text-content-primary">{run.provider ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-content-muted">Model</span>
                  <span className="text-label-md text-content-primary">{run.model ?? '—'}</span>
                </div>
              </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-border bg-surface-elevated px-5 py-4">
                <h2 className="text-card-title text-content-primary">Question</h2>
              </div>
              <div className="text-body-sm px-5 py-4 leading-6 text-content-secondary">
                {run.question ?? run.promptLabel ?? 'No question saved for this run.'}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-border bg-surface-elevated px-5 py-4">
                <h2 className="text-card-title text-content-primary">Saved Response</h2>
              </div>
              <div className="px-5 py-5">
                <pre className="text-body-sm whitespace-pre-wrap font-mono leading-6 text-content-primary">
                  {run.responseExcerpt || run.errorMessage || 'No response excerpt was stored for this run.'}
                </pre>
              </div>
            </Card>

            <Card padding="none" className="overflow-hidden">
              <div className="border-b border-border bg-surface-elevated px-5 py-4">
                <h2 className="text-card-title text-content-primary">Sources</h2>
              </div>
              <div className="px-5 py-4">
                {run.citations.length === 0 ? (
                  <div className="text-body-sm text-content-muted">No sources were saved for this run.</div>
                ) : (
                  <div className="space-y-2">
                    {run.citations.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-sm block truncate text-accent-text hover:underline"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
    </div>
  )
}
