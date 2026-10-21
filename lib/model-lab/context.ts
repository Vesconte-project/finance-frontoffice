import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { ModelLabError, type Viewer } from './contract'
import type { FixtureState } from './fixtures/source'
import type { ModelLabMode } from './mode'
import type { Depth } from './params'
import { openModelLab } from './server'
import type { ModelLabSource } from './source'
import { toModelLabError } from './backend-source'

export const DEPTH_COOKIE = 'model_lab_depth'

export type LabContext = Readonly<{
  mode: ModelLabMode
  source: ModelLabSource
  viewer: Viewer
  depth: Depth
  fixtureState: FixtureState | null
}>

export function resolveDepth(requested: string | undefined, viewer: Viewer): Depth {
  if (requested === 'lab' && viewer.role === 'team') return 'lab'
  if (requested === 'advanced' || requested === 'lab') return 'advanced'
  return 'guided'
}

/** One source and one viewer per request, shared by the layout and the page. */
export const labContext = cache(async (): Promise<LabContext> => {
  const opened = await openModelLab()
  let viewer: Viewer
  try {
    viewer = await opened.source.viewer()
  } catch (error) {
    throw toModelLabError(error)
  }
  const depth = resolveDepth((await cookies()).get(DEPTH_COOKIE)?.value, viewer)
  return { mode: opened.mode, source: opened.source, viewer, depth, fixtureState: opened.fixtureState }
})

export type Loaded<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: ModelLabError }>

/** Runs a read and turns a Model Lab failure into a value the page can show. */
export async function load<T>(read: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await read() }
  } catch (error) {
    return { ok: false, error: toModelLabError(error) }
  }
}
