/** Closed public contract of finance-backend's synthetic proof. */
export type Model = 'logistic_regression' | 'random_forest_classifier'
export type Variant = { name: string; model: Model; probability_threshold: 0.5 | 0.6 }
export type ComparisonRequest = { experiment_name: string; fixture: 'synthetic-market-v1'; variants: [Variant, Variant] }
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type Run = {
  experiment_id: string; experiment_name: string; variant: string | null; status: RunStatus
  comparison_id: string | null; public_request: ComparisonRequest | null
  definition_hash: string | null; orchestrator_config_hash: string | null; fixture_sha256: string | null
  created_at: string | null; started_at: string | null; finished_at: string | null
  parameters: { model: Model | null; probability_threshold: number | null }
  result_json: { metrics_summary_json: Record<string, number> } | null
}
export type RunEvent = { event_id: string; event_type: string; step: string | null; status: string | null; created_at: string | null }
export type Artifact = { artifact_id: string; artifact_type: string; artifact_hash: string | null; created_at: string | null }
export type Submission = { status: 'queued' | 'partial_failure'; members: { variant: string; experiment_id?: string; status: string; definition_hash: string | null; config_hash: string | null }[] }
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid public response')
  return v as Record<string, unknown>
}
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => k in v)
export function parseComparison(value: unknown): ComparisonRequest {
  const v = record(value)
  if (!exact(v, ['experiment_name', 'fixture', 'variants']) || typeof v.experiment_name !== 'string' || !/^[a-z][a-z0-9_]{0,59}$/.test(v.experiment_name) || v.fixture !== 'synthetic-market-v1' || !Array.isArray(v.variants) || v.variants.length !== 2) throw new Error('Invalid comparison')
  const variants = v.variants.map(item => {
    const x = record(item)
    if (!exact(x, ['name', 'model', 'probability_threshold']) || typeof x.name !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(x.name) || !isModel(x.model) || (x.probability_threshold !== 0.5 && x.probability_threshold !== 0.6)) throw new Error('Invalid variant')
    return { name: x.name, model: x.model, probability_threshold: x.probability_threshold } as Variant
  }) as [Variant, Variant]
  if (variants[0].name === variants[1].name || (variants[0].model === variants[1].model && variants[0].probability_threshold === variants[1].probability_threshold)) throw new Error('Variants must differ')
  return { experiment_name: v.experiment_name, fixture: v.fixture, variants }
}
function isModel(v: unknown): v is Model { return v === 'logistic_regression' || v === 'random_forest_classifier' }
function token(v: unknown): string { if (typeof v !== 'string' || !/^[A-Za-z0-9_.:-]{1,180}$/.test(v)) throw new Error('Invalid identifier'); return v }
function nullableToken(v: unknown) { return v == null ? null : token(v) }
function hash(v: unknown): string | null { if (v == null) return null; if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw new Error('Invalid hash'); return v }
function date(v: unknown): string | null { if (v == null) return null; if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/.test(v) || !Number.isFinite(Date.parse(v))) throw new Error('Invalid date'); return v }
function status(v: unknown): RunStatus { if (!['queued', 'running', 'completed', 'failed', 'cancelled'].includes(String(v))) throw new Error('Invalid status'); return v as RunStatus }
const metricKeys = ['sharpe', 'total_return', 'max_drawdown', 'annualized_return', 'volatility', 'win_rate', 'trade_count']
export function projectRun(value: unknown): Run {
  const v = record(value), p = record(v.parameters)
  const raw = v.result_json == null ? {} : record(record(v.result_json).metrics_summary_json)
  const metrics: Record<string, number> = {}
  metricKeys.forEach(k => { const n = raw[k]; if (typeof n === 'number' && Number.isFinite(n)) metrics[k] = n })
  const comparisonId = v.comparison_id
  if (comparisonId != null && (typeof comparisonId !== 'string' || !/^[a-f0-9]{32}$/.test(comparisonId))) throw new Error('Invalid comparison ID')
  return { experiment_id: token(v.experiment_id), experiment_name: token(v.experiment_name), variant: nullableToken(v.variant), status: status(v.status), comparison_id: comparisonId as string ?? null,
    public_request: v.public_request == null ? null : parseComparison(v.public_request), definition_hash: hash(v.definition_hash), orchestrator_config_hash: hash(v.orchestrator_config_hash), fixture_sha256: hash(v.fixture_sha256),
    created_at: date(v.created_at), started_at: date(v.started_at), finished_at: date(v.finished_at), parameters: { model: isModel(p.model) ? p.model : null, probability_threshold: p.probability_threshold === 0.5 || p.probability_threshold === 0.6 ? p.probability_threshold : null }, result_json: Object.keys(metrics).length ? { metrics_summary_json: metrics } : null }
}
export function projectEvent(value: unknown): RunEvent {
  const v = record(value); return { event_id: token(v.event_id), event_type: token(v.event_type), step: nullableToken(v.step), status: nullableToken(v.status), created_at: date(v.created_at) }
}
export function projectArtifact(value: unknown): Artifact {
  const v = record(value); return { artifact_id: token(v.artifact_id), artifact_type: token(v.artifact_type), artifact_hash: hash(v.artifact_hash), created_at: date(v.created_at) }
}
export function projectSubmission(value: unknown): Submission {
  const v = record(value)
  if ((v.status !== 'queued' && v.status !== 'partial_failure') || !Array.isArray(v.members) || v.members.length < 1 || v.members.length > 2) throw new Error('Invalid submission')
  return { status: v.status, members: v.members.map(item => { const m = record(item); return { variant: token(m.variant), ...(m.experiment_id == null ? {} : { experiment_id: token(m.experiment_id) }), status: status(m.status), definition_hash: hash(m.definition_hash), config_hash: hash(m.config_hash) } }) }
}
export function projectResponse(path: string, value: unknown): unknown {
  if (path === '/comparisons') return projectSubmission(value)
  if (path === '/experiments') { const v = record(value); if (!Array.isArray(v.jobs)) throw new Error('Invalid jobs'); return { jobs: v.jobs.map(projectRun) } }
  if (path.endsWith('/events')) { const v = record(value); if (!Array.isArray(v.events)) throw new Error('Invalid events'); return { events: v.events.map(projectEvent) } }
  if (path.endsWith('/artifacts')) { const v = record(value); if (!Array.isArray(v.artifacts)) throw new Error('Invalid artifacts'); return { artifacts: v.artifacts.map(projectArtifact) } }
  if (path.includes('/artifacts/')) return projectArtifact(value)
  return projectRun(value)
}
export const statusLabel: Record<RunStatus, string> = { queued: 'Queued', running: 'Running', completed: 'Execution completed', failed: 'Execution failed', cancelled: 'Cancelled' }
