import 'server-only'

import { fetchBackendResponse } from './backend'
import {
  atlasDenial,
  parseCompanyPanel,
  parseOverview,
  parseZonePanel,
  type AtlasCompanyPanel,
  type AtlasDenial,
  type AtlasOverview,
  type AtlasLens,
  type AtlasZonePanel,
} from './atlas-model'
import {
  parseCompare,
  parseInfluence,
  parseMovement,
  parseTest,
  parseThemeDetail,
  parseThemes,
  parseWeeks,
  type AtlasCompare,
  type AtlasInfluence,
  type AtlasMovement,
  type AtlasTest,
  type AtlasTheme,
  type AtlasThemeDetail,
  type AtlasWeeks,
} from './atlas-pro-model'

export type AtlasResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'denied'; reason: AtlasDenial }
  | { status: 'not_found' }
  /** The backend could not answer this question as asked (422), e.g. two sets that are the same. */
  | { status: 'invalid' }
  | { status: 'unavailable' }

/**
 * One backend read. The reader's session, when there is one, is forwarded by
 * `fetchBackendResponse`; without one the backend serves the signed-out
 * projection. A refusal keeps its reason so the screen can say what unlocks it.
 */
async function readAtlas<T>(path: string, context: string, parse: (value: unknown) => T | null, init?: RequestInit): Promise<AtlasResult<T>> {
  let response: Response
  try {
    response = await fetchBackendResponse(path, { context, timeoutMs: 9000, init })
  } catch {
    return { status: 'unavailable' }
  }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    body = null
  }
  if (response.status === 403) {
    const reason = atlasDenial(body)
    return reason ? { status: 'denied', reason } : { status: 'unavailable' }
  }
  if (response.status === 404) return { status: 'not_found' }
  if (response.status === 422) return { status: 'invalid' }
  if (!response.ok) return { status: 'unavailable' }
  const data = parse(body)
  return data ? { status: 'ok', data } : { status: 'unavailable' }
}

function query(values: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** The residual lens is the default and is never sent, so a free reader's request stays as it was. */
const lensParam = (lens?: AtlasLens) => (lens === 'total' ? 'total' : null)

export function getAtlasOverview(level: number, bbox?: string | null, options: { asOf?: string | null; lens?: AtlasLens } = {}): Promise<AtlasResult<AtlasOverview>> {
  return readAtlas(`/v1/atlas${query({ level: String(level), bbox, asOf: options.asOf, lens: lensParam(options.lens) })}`, 'atlas.overview', parseOverview)
}

export function getAtlasCompany(symbol: string, lens?: AtlasLens): Promise<AtlasResult<AtlasCompanyPanel>> {
  return readAtlas(`/v1/atlas/companies/${encodeURIComponent(symbol)}${query({ lens: lensParam(lens) })}`, 'atlas.company', parseCompanyPanel)
}

export function getAtlasWeeks(): Promise<AtlasResult<AtlasWeeks>> {
  return readAtlas('/v1/atlas/weeks', 'atlas.weeks', parseWeeks)
}

export function getAtlasMovement(from: string, to?: string | null): Promise<AtlasResult<AtlasMovement>> {
  return readAtlas(`/v1/atlas/movement${query({ from, to })}`, 'atlas.movement', parseMovement)
}

export function getAtlasThemes(asOf?: string | null): Promise<AtlasResult<AtlasTheme[]>> {
  return readAtlas(`/v1/atlas/themes${query({ asOf })}`, 'atlas.themes', parseThemes)
}

export function getAtlasTheme(themeId: string, asOf?: string | null): Promise<AtlasResult<AtlasThemeDetail>> {
  return readAtlas(`/v1/atlas/themes/${encodeURIComponent(themeId)}${query({ asOf })}`, 'atlas.theme', parseThemeDetail)
}

export function getAtlasInfluence(asOf?: string | null): Promise<AtlasResult<AtlasInfluence>> {
  return readAtlas(`/v1/atlas/influence${query({ asOf })}`, 'atlas.influence', parseInfluence)
}

export function getAtlasCompare(a: string, b: string, asOf?: string | null): Promise<AtlasResult<AtlasCompare>> {
  return readAtlas(`/v1/atlas/compare${query({ a, b, asOf })}`, 'atlas.compare', parseCompare)
}

export function getAtlasTest(options: { from: string; to: string; testsRun: number; asOf?: string | null }): Promise<AtlasResult<AtlasTest>> {
  return readAtlas(`/v1/atlas/test${query({ from: options.from, to: options.to, testsRun: String(options.testsRun), asOf: options.asOf })}`, 'atlas.test', parseTest)
}

export function getAtlasZone(zoneId: string, lens?: AtlasLens): Promise<AtlasResult<AtlasZonePanel>> {
  return readAtlas(`/v1/atlas/zones/${encodeURIComponent(zoneId)}${query({ lens: lensParam(lens) })}`, 'atlas.zone', parseZonePanel)
}

/** The same answer as a local route response: the data, or the refusal with its own status. */
export function atlasRouteResponse<T>(result: AtlasResult<T>): Response {
  const headers = { 'Cache-Control': 'private, no-store' }
  switch (result.status) {
    case 'ok':
      return Response.json(result.data, { headers })
    case 'denied':
      return Response.json({ detail: result.reason }, { status: 403, headers })
    case 'not_found':
      return Response.json({ detail: 'not_found' }, { status: 404, headers })
    case 'invalid':
      return Response.json({ detail: 'invalid' }, { status: 422, headers })
    default:
      return Response.json({ detail: 'unavailable' }, { status: 503, headers })
  }
}
