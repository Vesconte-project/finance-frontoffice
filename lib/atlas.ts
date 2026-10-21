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
  type AtlasZonePanel,
} from './atlas-model'

export type AtlasResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'denied'; reason: AtlasDenial }
  | { status: 'not_found' }
  | { status: 'unavailable' }

/**
 * One backend read. The reader's session, when there is one, is forwarded by
 * `fetchBackendResponse`; without one the backend serves the signed-out
 * projection. A refusal keeps its reason so the screen can say what unlocks it.
 */
async function readAtlas<T>(path: string, context: string, parse: (value: unknown) => T | null): Promise<AtlasResult<T>> {
  let response: Response
  try {
    response = await fetchBackendResponse(path, { context, timeoutMs: 9000 })
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
  if (!response.ok) return { status: 'unavailable' }
  const data = parse(body)
  return data ? { status: 'ok', data } : { status: 'unavailable' }
}

export function getAtlasOverview(level: number, bbox?: string | null): Promise<AtlasResult<AtlasOverview>> {
  const params = new URLSearchParams({ level: String(level) })
  if (bbox) params.set('bbox', bbox)
  return readAtlas(`/v1/atlas?${params.toString()}`, 'atlas.overview', parseOverview)
}

export function getAtlasCompany(symbol: string): Promise<AtlasResult<AtlasCompanyPanel>> {
  return readAtlas(`/v1/atlas/companies/${encodeURIComponent(symbol)}`, 'atlas.company', parseCompanyPanel)
}

export function getAtlasZone(zoneId: string): Promise<AtlasResult<AtlasZonePanel>> {
  return readAtlas(`/v1/atlas/zones/${encodeURIComponent(zoneId)}`, 'atlas.zone', parseZonePanel)
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
    default:
      return Response.json({ detail: 'unavailable' }, { status: 503, headers })
  }
}
