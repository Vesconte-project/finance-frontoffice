import type {
  AlertItem,
  Candidate,
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
  Quote,
  Run,
  SharedModel,
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
  /** Admins only, and only for their own thesis. */
  shareThesis(thesisId: string): Promise<ThesisSummary>

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

  /** Admins only. Approval, deployments, analytics and monitoring live in the backoffice. */
  adminShared(): Promise<readonly SharedModel[]>
  adminCandidates(): Promise<readonly Candidate[]>
  /** The thesis must be the admin's own or shared by another admin. */
  selectCandidate(thesisId: string): Promise<Candidate>
  adminPipeline(kind: PipelineKind): Promise<PipelineView>
}
