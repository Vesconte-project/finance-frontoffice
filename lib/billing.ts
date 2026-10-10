import 'server-only'
import { platformAccess, platformEnabled } from './platform-server'

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

function normalizePlan(value: unknown): BillingPlan {
  if (typeof value !== 'string') return 'free'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'pro' || normalized === 'premium' || normalized === 'paid') return 'pro'
  return 'free'
}

function readObjectField(obj: unknown, field: string): unknown {
  if (!obj || typeof obj !== 'object') return null
  return (obj as Record<string, unknown>)[field]
}

function readPlanFromSessionClaims(sessionClaims: unknown): BillingPlan | null {
  const metadataPlan = normalizePlan(readObjectField(readObjectField(sessionClaims, 'metadata'), 'plan'))
  if (metadataPlan === 'pro') return 'pro'

  const publicMetadataPlan = normalizePlan(
    readObjectField(readObjectField(sessionClaims, 'public_metadata'), 'plan')
  )
  if (publicMetadataPlan === 'pro') return 'pro'

  const directPlan = normalizePlan(readObjectField(sessionClaims, 'plan'))
  if (directPlan === 'pro') return 'pro'

  return null
}

async function readPlanFromClerkUser(userId: string): Promise<BillingPlan | null> {
  try {
    const { clerkClient } = await import('@clerk/nextjs/server')
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    const publicPlan = normalizePlan(readObjectField(user.publicMetadata, 'plan'))
    if (publicPlan === 'pro') return 'pro'

    const privatePlan = normalizePlan(readObjectField(user.privateMetadata, 'plan'))
    if (privatePlan === 'pro') return 'pro'

    return 'free'
  } catch {
    return null
  }
}

export async function getViewerAccess(options: { publicPage?: boolean } = {}): Promise<ViewerAccess> {
  // Marketing pages deliberately have no Clerk middleware or per-user access.
  if (options.publicPage) return DEFAULT_ACCESS
  if (platformEnabled()) {
    const { auth } = await import('@clerk/nextjs/server')
    const state = await auth()
    if (!state.userId) return DEFAULT_ACCESS
    // Preserve an unavailable authority as an error; do not present an
    // authenticated paid customer as signed out or Free when the API fails.
    const { access } = await platformAccess()
    const isPro = access.features['research.ai']?.allowed === true
    return { userId: state.userId, isSignedIn: true, plan: isPro ? 'pro' : 'free', isPro }
  }
  try {
    const { auth } = await import('@clerk/nextjs/server')
    const state = await auth()
    const userId = state.userId ?? null

    if (!userId) return DEFAULT_ACCESS

    const claimPlan = readPlanFromSessionClaims(state.sessionClaims)
    if (claimPlan) {
      return {
        userId,
        isSignedIn: true,
        plan: claimPlan,
        isPro: claimPlan === 'pro',
      }
    }

    const userPlan = await readPlanFromClerkUser(userId)
    const plan = userPlan ?? 'free'
    return {
      userId,
      isSignedIn: true,
      plan,
      isPro: plan === 'pro',
    }
  } catch {
    return DEFAULT_ACCESS
  }
}

export function getStripeUpgradeUrl(userId?: string | null): string | null {
  if (platformEnabled()) return '/dashboard/research/synthetic'
  const raw = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK?.trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    if (userId) url.searchParams.set('client_reference_id', userId)
    return url.toString()
  } catch {
    return null
  }
}
