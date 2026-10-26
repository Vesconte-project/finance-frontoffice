import { signVisitorIP } from './proof.generated'

// Isolated fixture: no Clerk verification or deployed endpoint. The backend
// validates the synthetic identity and the real production IP signing helper.
export async function loadRequired(status, incoming) {
  const path = '/v1/tickers/ACME/summary'
  const proof = signVisitorIP(incoming.get('x-vercel-forwarded-for'), 'GET', path,
    { VERCEL: '1', BFF_IP_PROOF_KEY: process.env.BFF_IP_PROOF_KEY })
  const response = await fetch(`${process.env.FIXTURE_BACKEND}${path}?status=${status}`, {
    cache: 'no-store', signal: AbortSignal.timeout(5000), headers: {
      ...proof, authorization: incoming.get('authorization') || '',
      'x-fixture-case': incoming.get('x-fixture-case') || 'unknown',
    },
  })
  return { status: response.status, retryAfter: response.headers.get('retry-after'), data: await response.json() }
}
