import 'server-only'
import { accessHeaders, signVisitorIP } from './backend-origin-proof'
import { headers } from 'next/headers'

export async function backendOriginHeaders(url: URL, method: string): Promise<Record<string, string>> {
  const transport = accessHeaders()
  if (process.env.VERCEL !== '1' || !process.env.BFF_IP_PROOF_KEY) return transport
  const incoming = await headers()
  // Vercel overwrites this platform header; never accept browser-supplied XFF.
  const ip = process.env.VERCEL === '1' ? incoming.get('x-vercel-forwarded-for') : null
  return { ...accessHeaders(), ...signVisitorIP(ip, method, decodeURIComponent(url.pathname)) }
}
