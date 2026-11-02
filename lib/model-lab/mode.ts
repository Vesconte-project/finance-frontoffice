import { ModelLabError } from './contract'

type Env = Readonly<Record<string, string | undefined>>

/**
 * How the Model Lab gets its data.
 *
 * - `backend`: the platform API (`/v1/model-lab/*`). Until the backend serves it,
 *   the Model Lab shows that it is not open yet.
 * - `fixtures`: repository-owned synthetic data held in the server's memory, for
 *   design review and browser QA. Needs `MODEL_LAB_FIXTURES=true`, and never runs
 *   on Vercel Production, whatever the variable says.
 */
export type ModelLabMode = 'backend' | 'fixtures'

export function modelLabMode(env: Env = process.env): ModelLabMode {
  if (env.MODEL_LAB_FIXTURES === 'true' && env.VERCEL_ENV !== 'production') return 'fixtures'
  return 'backend'
}

/** A platform without the Model Lab routes answers 404 to the viewer: it is not open yet. */
export function notOpenYet(error: ModelLabError): ModelLabError {
  return error.code === 'not-found' ? new ModelLabError('unavailable') : error
}
