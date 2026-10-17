import 'server-only'
import { platformAccess } from './platform-server'

export type BillingPlan = 'free' | 'pro'

export type ViewerAccess = {
  userId: string | null
  isSignedIn: boolean
  plan: BillingPlan
  isPro: boolean
}

const DEFAULT_ACCESS: ViewerAccess = {
  userId: null,
  isSignedIn: false,
  plan: 'free',
  isPro: false,
}

export async function getViewerAccess(options: { publicPage?: boolean } = {}): Promise<ViewerAccess> {
  // Marketing pages deliberately have no Clerk middleware or per-user access.
  if (options.publicPage) return DEFAULT_ACCESS
  const { auth } = await import('@clerk/nextjs/server')
  const state = await auth()
  if (!state.userId) return DEFAULT_ACCESS
  const { access } = await platformAccess()
  const isPro = access.features['research.ai']?.allowed === true
  return { userId: state.userId, isSignedIn: true, plan: isPro ? 'pro' : 'free', isPro }
}
