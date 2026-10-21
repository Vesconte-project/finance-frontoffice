import { ModelLabError, statusFromError } from './contract'
import type { ModelLabSource } from './source'
import { parseAccessRequest, parseAlertsRead, parseDraft, parseNote, parsePanelDraft, parsePanelPatch, parseWatch, isUuid } from './validate'
import type { PipelineKind } from './contract'

export type BffMethod = 'GET' | 'POST' | 'PATCH'
export type BffRequest = Readonly<{ method: BffMethod; parts: readonly string[]; body: unknown; idempotencyKey: string | null }>
export type BffResponse = Readonly<{ status: number; body: unknown; retryAfter: number | null }>

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,128}$/

function id(part: string | undefined): string {
  if (!part || !isUuid(part)) throw new ModelLabError('not-found')
  return part
}

function pipelineKind(part: string | undefined): PipelineKind {
  if (part === 'thesis' || part === 'reuse' || part === 'panel') return part
  throw new ModelLabError('not-found')
}

async function get(source: ModelLabSource, p: readonly string[]): Promise<unknown> {
  const [a, b, c] = p
  if (p.length === 1) {
    if (a === 'viewer') return source.viewer()
    if (a === 'theses') return { theses: await source.listTheses() }
    if (a === 'panels') return { panels: await source.listPanels() }
    if (a === 'library') return { models: await source.libraryModels() }
    if (a === 'alerts') return { alerts: await source.listAlerts() }
  }
  if (a === 'theses' && p.length === 2) return source.getThesis(id(b))
  if (a === 'theses' && p.length === 3 && c === 'evidence') return source.getEvidence(id(b))
  if (a === 'tests' && p.length === 3 && c === 'results') return source.getTestResults(id(b))
  if (a === 'runs' && p.length === 2) return source.getRun(id(b))
  if (a === 'panels' && p.length === 2) return source.getPanel(id(b))
  if (a === 'panels' && p.length === 3) {
    if (c === 'today') return source.panelToday(id(b))
    if (c === 'evidence') return source.panelEvidence(id(b))
    if (c === 'alerts') return source.panelAlerts(id(b))
  }
  if (a === 'admin' && p.length === 2) {
    if (b === 'queue') return { rows: await source.teamQueue() }
    if (b === 'candidates') return { candidates: await source.teamCandidates() }
    if (b === 'access-requests') return { requests: await source.teamAccessRequests() }
    if (b === 'data-health') return source.teamDataHealth()
  }
  if (a === 'admin' && b === 'pipeline' && p.length === 3) return source.teamPipeline(pipelineKind(c))
  throw new ModelLabError('not-found')
}

async function post(source: ModelLabSource, p: readonly string[], body: unknown, key: string | null): Promise<unknown> {
  const [a, b, c] = p
  if (p.length === 1 && a === 'quotes') return source.quote(parseDraft(body))
  if (p.length === 1 && a === 'runs') {
    if (!key || !IDEMPOTENCY_KEY.test(key)) throw new ModelLabError('invalid')
    return source.submitRun(parseDraft(body), key)
  }
  if (a === 'runs' && p.length === 3 && c === 'cancel') return source.cancelRun(id(b))
  if (p.length === 1 && a === 'panels') return source.createPanel(parsePanelDraft(body))
  if (a === 'alerts' && b === 'read' && p.length === 2) {
    await source.markAlertsRead(parseAlertsRead(body))
    return { ok: true }
  }
  if (a === 'theses' && p.length === 3 && c === 'notes') return source.addNote(id(b), parseNote(body))
  if (a === 'theses' && p.length === 3 && c === 'submit') return source.submitCopy(id(b))
  if (a === 'admin' && b === 'access-requests' && p.length === 2) {
    const r = parseAccessRequest(body)
    return source.requestAccess(r.experimentId, r.reason, r.expires)
  }
  throw new ModelLabError('not-found')
}

async function patch(source: ModelLabSource, p: readonly string[], body: unknown): Promise<unknown> {
  const [a, b, c] = p
  if (a === 'panels' && p.length === 2) return source.updatePanel(id(b), parsePanelPatch(body))
  if (a === 'theses' && p.length === 3 && c === 'watch') return source.updateWatch(id(b), parseWatch(body))
  throw new ModelLabError('not-found')
}

/** One entry point for every Model Lab request, whatever source is behind it. */
export async function handleModelLabRequest(source: ModelLabSource, request: BffRequest): Promise<BffResponse> {
  try {
    const body =
      request.method === 'GET'
        ? await get(source, request.parts)
        : request.method === 'POST'
          ? await post(source, request.parts, request.body, request.idempotencyKey)
          : await patch(source, request.parts, request.body)
    return { status: request.method === 'POST' && request.parts[0] === 'runs' && request.parts.length === 1 ? 202 : 200, body, retryAfter: null }
  } catch (error) {
    const failure = error instanceof ModelLabError ? error : new ModelLabError('upstream')
    return { status: statusFromError(failure), body: { error: failure.code, message: failure.message }, retryAfter: failure.retryAfter }
  }
}
