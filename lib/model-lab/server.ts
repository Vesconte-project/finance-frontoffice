import 'server-only'
import { cookies } from 'next/headers'
import { BackendSource } from './backend-source'
import { ModelLabError } from './contract'
import { FIXTURE_STATE_COOKIE, FixtureSource, parseFixtureState, type FixtureState } from './fixtures/source'
import { modelLabMode, type ModelLabMode } from './mode'
import type { ModelLabSource } from './source'
import { platformEnabled } from '../platform-server'

export type Opened = Readonly<{ mode: ModelLabMode; source: ModelLabSource; fixtureState: FixtureState | null }>

/** The source for this request, or `unavailable` when the Model Lab is not open. */
export async function openModelLab(): Promise<Opened> {
  const mode = modelLabMode()
  if (mode === 'fixtures') {
    const state = parseFixtureState((await cookies()).get(FIXTURE_STATE_COOKIE)?.value)
    return { mode, source: new FixtureSource(state), fixtureState: state }
  }
  if (mode === 'backend') {
    if (!platformEnabled()) throw new ModelLabError('unavailable')
    return { mode, source: await BackendSource.open(), fixtureState: null }
  }
  throw new ModelLabError('unavailable')
}
