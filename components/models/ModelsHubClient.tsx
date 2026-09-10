'use client'

import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import Badge from '@/components/ui/Badge'
import DismissibleLocalHint from '@/components/onboarding/DismissibleLocalHint'
import { buttonClass } from '@/components/ui/Button'
import { loadModelsFromStorage } from '@/lib/model-store-client'
import { modelSummaryResult, universeLabel } from '@/lib/model-builder'
import { buildSampleModelDraftSeed, SAMPLE_MODEL_ID } from '@/lib/model-samples'
import { trackEvent } from '@/lib/analytics'

function formatDate(value: string | null): string {
  if (!value) return 'Not run yet'
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return 'Not run yet'
  return new Date(parsed).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function ModelsHubClient() {
  const models = loadModelsFromStorage()
  const sampleDraftHref = `/models/new?draft=${encodeURIComponent(
    JSON.stringify(buildSampleModelDraftSeed())
  )}`
  const sampleModelHref = `/models/${SAMPLE_MODEL_ID}?from=models_hub`

  return (
    <div className="container-md section-gap">
        <PageHeader
          title="Model Lab"
          subtitle="Build, test, and compare investing systems before they earn a place in your workflow."
          action={
            <Link href="/models/new" className={buttonClass({ variant: 'primary' })}>
              New model
            </Link>
          }
        />
        <DismissibleLocalHint
          storageKey="vesconte_onboarding_loop_hint_dismissed_v1"
          text="Start here: Explore a model → tweak it → compare results"
        />

        {models.length === 0 ? (
          <Card>
            <EmptyState
              title="No models yet"
              description="Start with a template or explore a sample model."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link href={sampleDraftHref} className={buttonClass({ variant: 'primary' })}>
                    Start with template
                  </Link>
                  <Link
                    href={sampleModelHref}
                    className={buttonClass({ variant: 'secondary' })}
                    onClick={() =>
                      trackEvent('click_sample_model', {
                        model_id: SAMPLE_MODEL_ID,
                        source: 'models_empty_state',
                        entry_source: 'models_hub',
                      })
                    }
                  >
                    Explore sample model
                  </Link>
                </div>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {models.map((model) => (
              <Card key={model.id} className="section-gap">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-card-title text-content-primary">{model.name}</div>
                    <div className="text-caption mt-1 text-content-muted">
                      {universeLabel(model.universe)}
                      {model.ticker ? ` · ${model.ticker}` : ''}
                    </div>
                  </div>
                  <Badge variant={model.status === 'validated' ? 'success' : 'warning'}>
                    {model.status === 'validated' ? 'Validated' : 'Draft'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-1">
                    <div className="text-caption text-content-muted numeric-tabular">
                      Last run: {formatDate(model.lastRunAt)}
                    </div>
                    <div className="text-label-md text-content-primary">{modelSummaryResult(model)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/models/${model.id}?from=models_hub`} className={buttonClass({ variant: 'secondary' })}>
                      Open
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
