import type {
  AccessRequest,
  AlertItem,
  Candidate,
  DataHealth,
  Draft,
  LibraryModel,
  Note,
  PanelAlerts,
  PanelDraft,
  PanelEvidence,
  PanelSummary,
  PanelToday,
  PipelineKind,
  PipelineView,
  QueueRow,
  Quote,
  Run,
  TestResults,
  ThesisDetail,
  ThesisEvidence,
  ThesisSummary,
  Viewer,
  WatchSettings,
} from './contract'

export type PanelPatch = Readonly<{
  name?: string
  memberRunIds?: readonly string[]
  rule?: PanelSummary['rule']
  agreementNeeded?: number
  below?: PanelSummary['below']
  holdDays?: number
  quietDays?: number
  weeklyCap?: number
  alerts?: Partial<PanelSummary['alerts']>
  channels?: PanelSummary['channels']
}>

/**
 * Everything the Model Lab pages and routes need. The platform API implements it
 * for real; the fixture source implements it with synthetic data for design review
 * and browser QA. Both throw `ModelLabError` for anything the reader should see.
 */
export interface ModelLabSource {
  viewer(): Promise<Viewer>

  listTheses(): Promise<readonly ThesisSummary[]>
  getThesis(id: string): Promise<ThesisDetail>
  getEvidence(id: string): Promise<ThesisEvidence>
  getTestResults(testId: string): Promise<TestResults>
  addNote(thesisId: string, text: string): Promise<Note>
  updateWatch(thesisId: string, watch: WatchSettings): Promise<WatchSettings>
  submitCopy(thesisId: string): Promise<ThesisSummary>

  quote(draft: Draft): Promise<Quote>
  submitRun(draft: Draft, idempotencyKey: string): Promise<Run>
  getRun(runId: string): Promise<Run>
  cancelRun(runId: string): Promise<Run>

  listPanels(): Promise<readonly PanelSummary[]>
  getPanel(id: string): Promise<PanelSummary>
  createPanel(draft: PanelDraft): Promise<PanelSummary>
  updatePanel(id: string, patch: PanelPatch): Promise<PanelSummary>
  panelToday(id: string): Promise<PanelToday>
  panelEvidence(id: string): Promise<PanelEvidence>
  panelAlerts(id: string): Promise<PanelAlerts>
  libraryModels(): Promise<readonly LibraryModel[]>

  listAlerts(): Promise<readonly AlertItem[]>
  markAlertsRead(ids: readonly string[] | 'all'): Promise<void>

  teamQueue(): Promise<readonly QueueRow[]>
  teamPipeline(kind: PipelineKind): Promise<PipelineView>
  teamCandidates(): Promise<readonly Candidate[]>
  teamAccessRequests(): Promise<readonly AccessRequest[]>
  requestAccess(experimentId: string, reason: string, expires: '24h' | '7d'): Promise<AccessRequest>
  teamDataHealth(): Promise<DataHealth>
}
