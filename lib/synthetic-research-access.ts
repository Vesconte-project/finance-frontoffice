import 'server-only'
export function syntheticResearchEnabled(): boolean {
  return process.env.RESEARCH_SYNTHETIC_ENABLED === 'true' && process.env.VERCEL_ENV !== 'production'
}
