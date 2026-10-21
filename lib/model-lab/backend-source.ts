import 'server-only'
import { camelizeKeys, snakeizeKeys } from './case'
import {
  ModelLabError,
  errorFromStatus,
  type AccessRequest,
  type AlertItem,
  type Candidate,
  type DataHealth,
  type Draft,
  type LibraryModel,
  type Note,
  type PanelAlerts,
  type PanelDraft,
  type PanelEvidence,
  type PanelSummary,
  type PanelToday,
  type PipelineKind,
  type PipelineView,
  type QueueRow,
  type Quote,
  type Run,
  type TestResults,
  type ThesisDetail,
  type ThesisEvidence,
  type ThesisSummary,
  type Viewer,
  type WatchSettings,
} from './contract'
import { PlatformError } from '../platform-client'
import { platformSession } from '../platform-server'
import type { ModelLabSource, PanelPatch } from './source'

type Session = Awaited<ReturnType<typeof platformSession>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The real source: the platform API under `/v1/model-lab`, scoped to the signed-in
 * account. The API is described in `docs/api/model-lab.md`. Until the backend
 * serves it, every call ends in `unavailable` or `not-found`, and the pages show
 * that state instead of inventing data.
 */
export class BackendSource implements ModelLabSource {
  private constructor(private readonly session: Session) {}

  static async open(): Promise<BackendSource> {
    try {
      return new BackendSource(await platformSession())
    } catch (error) {
      throw toModelLabError(error)
    }
  }

  private scoped(path: string): string {
    return `${path}${path.includes('?') ? '&' : '?'}account_id=${this.session.account.id}`
  }

  private async read<T>(path: string): Promise<T> {
    try {
      const response = await this.session.request(this.scoped(path))
      return camelizeKeys<T>(await response.json())
    } catch (error) {
      throw toModelLabError(error)
    }
  }

  private async send<T>(method: 'POST' | 'PATCH', path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    try {
      const payload = snakeizeKeys({ accountId: this.session.account.id, ...(isRecord(body) ? body : { value: body }) })
      const response = await this.session.request(path, { method, body: payload, idempotencyKey })
      return camelizeKeys<T>(await response.json())
    } catch (error) {
      throw toModelLabError(error)
    }
  }

  private list<T>(value: unknown, key: string): readonly T[] {
    if (!isRecord(value) || !Array.isArray(value[key])) throw new ModelLabError('upstream')
    return value[key] as T[]
  }

  viewer = () => this.read<Viewer>('/model-lab/viewer')
  async listTheses() { return this.list<ThesisSummary>(await this.read('/model-lab/theses'), 'theses') }
  getThesis = (id: string) => this.read<ThesisDetail>(`/model-lab/theses/${id}`)
  getEvidence = (id: string) => this.read<ThesisEvidence>(`/model-lab/theses/${id}/evidence`)
  getTestResults = (id: string) => this.read<TestResults>(`/model-lab/tests/${id}/results`)
  addNote = (thesisId: string, text: string) => this.send<Note>('POST', `/model-lab/theses/${thesisId}/notes`, { text })
  updateWatch = (thesisId: string, watch: WatchSettings) => this.send<WatchSettings>('PATCH', `/model-lab/theses/${thesisId}/watch`, watch)
  submitCopy = (thesisId: string) => this.send<ThesisSummary>('POST', `/model-lab/theses/${thesisId}/submit`, {})

  quote = (draft: Draft) => this.send<Quote>('POST', '/model-lab/quotes', draft)
  submitRun = (draft: Draft, key: string) => this.send<Run>('POST', '/model-lab/runs', draft, key)
  getRun = (id: string) => this.read<Run>(`/model-lab/runs/${id}`)
  cancelRun = (id: string) => this.send<Run>('POST', `/model-lab/runs/${id}/cancel`, {})

  async listPanels() { return this.list<PanelSummary>(await this.read('/model-lab/panels'), 'panels') }
  getPanel = (id: string) => this.read<PanelSummary>(`/model-lab/panels/${id}`)
  createPanel = (draft: PanelDraft) => this.send<PanelSummary>('POST', '/model-lab/panels', draft)
  updatePanel = (id: string, patch: PanelPatch) => this.send<PanelSummary>('PATCH', `/model-lab/panels/${id}`, patch)
  panelToday = (id: string) => this.read<PanelToday>(`/model-lab/panels/${id}/today`)
  panelEvidence = (id: string) => this.read<PanelEvidence>(`/model-lab/panels/${id}/evidence`)
  panelAlerts = (id: string) => this.read<PanelAlerts>(`/model-lab/panels/${id}/alerts`)
  async libraryModels() { return this.list<LibraryModel>(await this.read('/model-lab/library'), 'models') }

  async listAlerts() { return this.list<AlertItem>(await this.read('/model-lab/alerts'), 'alerts') }
  async markAlertsRead(ids: readonly string[] | 'all') { await this.send('POST', '/model-lab/alerts/read', { ids }) }

  async teamQueue() { return this.list<QueueRow>(await this.read('/model-lab/admin/queue'), 'rows') }
  teamPipeline = (kind: PipelineKind) => this.read<PipelineView>(`/model-lab/admin/pipeline/${kind}`)
  async teamCandidates() { return this.list<Candidate>(await this.read('/model-lab/admin/candidates'), 'candidates') }
  async teamAccessRequests() { return this.list<AccessRequest>(await this.read('/model-lab/admin/access-requests'), 'requests') }
  requestAccess = (experimentId: string, reason: string, expires: '24h' | '7d') =>
    this.send<AccessRequest>('POST', '/model-lab/admin/access-requests', { experimentId, reason, expires })
  teamDataHealth = () => this.read<DataHealth>('/model-lab/admin/data-health')
}

export function toModelLabError(error: unknown): ModelLabError {
  if (error instanceof ModelLabError) return error
  if (error instanceof PlatformError) return errorFromStatus(error.status, error.retryAfter)
  return new ModelLabError('upstream')
}
