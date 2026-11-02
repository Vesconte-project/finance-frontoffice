type Env = Readonly<Record<string, string | undefined>>

/**
 * How the Model Lab gets its data.
 *
 * - `backend`: the platform API (`/v1/model-lab/*`). Needs `MODEL_LAB_ENABLED=true`
 *   and the platform API to be on.
 * - `fixtures`: repository-owned synthetic data held in the server's memory, for
 *   design review and browser QA. Needs `MODEL_LAB_FIXTURES=true`, and never runs
 *   on Vercel Production, whatever the variable says.
 * - `off`: the Model Lab shows that it is not open yet.
 */
export type ModelLabMode = 'backend' | 'fixtures' | 'off'

export function modelLabMode(env: Env = process.env): ModelLabMode {
  if (env.MODEL_LAB_FIXTURES === 'true' && env.VERCEL_ENV !== 'production') return 'fixtures'
  if (env.MODEL_LAB_ENABLED === 'true') return 'backend'
  return 'off'
}
