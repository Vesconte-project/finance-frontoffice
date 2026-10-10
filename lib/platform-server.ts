import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createPlatformClient, PlatformError } from './platform-client'

export type PlatformAccount = {
  id: string; type: 'personal' | 'organization'; status: 'active' | 'suspended' | 'closed'
  role: 'owner' | 'admin' | 'member' | 'unmapped'; clerk_organization_id: string | null
}
export type PlatformAccess = {
  account_id: string; policy_version: string; can_manage_billing: boolean
  features: Record<string, { allowed: boolean; reason: string }>
  commercial_sync: { status: string; last_confirmed_at: string | null; operational_read_until: string | null }
  research_actions: Record<string, unknown> | null
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function platformEnabled() {
  const mode = process.env.NEXT_PUBLIC_PLATFORM_API_ENABLED
  if (mode === undefined || mode === 'false') return false
  if (mode !== 'true') throw new PlatformError(503)
  return true
}

/** Resolve the active Clerk organization to an account verified by the Backend. */
export async function platformSession() {
  const session = await auth()
  if (!session.userId) throw new PlatformError(401)
  const request = createPlatformClient({ baseUrl: process.env.NEXT_PUBLIC_PLATFORM_API_BASE_URL || '',
    // Server auth has no skipCache option. An explicit lifetime requests a new
    // default session token from Clerk on the single 401 retry, never a template.
    getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined) })
  const me = await (await request('/me')).json() as { user?: { id?: unknown }; accounts?: PlatformAccount[] }
  if (!me.user || typeof me.user.id !== 'string' || !uuid.test(me.user.id) || !Array.isArray(me.accounts))
    throw new PlatformError(502)
  const account = me.accounts.find(row => session.orgId
    ? row.type === 'organization' && row.clerk_organization_id === session.orgId
    : row.type === 'personal')
  // Do not silently switch an unverified organization request to a personal account.
  if (!account || !uuid.test(account.id)) throw new PlatformError(404)
  if (account.status !== 'active') throw new PlatformError(403)
  return { request, account, clerkUserId: session.userId, userId: me.user.id }
}

export async function platformAccess() {
  const session = await platformSession()
  const access = await (await session.request(`/accounts/${session.account.id}/access`)).json() as PlatformAccess
  if (access.account_id !== session.account.id || !access.features || typeof access.policy_version !== 'string')
    throw new PlatformError(502)
  for (const feature of Object.values(access.features))
    if (!feature || typeof feature.allowed !== 'boolean' || typeof feature.reason !== 'string') throw new PlatformError(502)
  return { ...session, access }
}
