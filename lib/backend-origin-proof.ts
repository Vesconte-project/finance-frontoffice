import { createHmac, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'

/** Access is origin transport. The separate proof key grants no API permission. */
export function accessHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const id = env.CF_ACCESS_CLIENT_ID?.trim()
  const secret = env.CF_ACCESS_CLIENT_SECRET?.trim()
  if (Boolean(id) !== Boolean(secret)) throw new Error('Backend origin transport is unavailable')
  return id && secret ? { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret } : {}
}

export function signVisitorIP(ip: string | null, method: string, path: string,
  env: Record<string, string | undefined> = process.env): Record<string, string> {
  const key = env.BFF_IP_PROOF_KEY
  // Only Vercel's production runtime may use the production proof. Local or
  // preview environments need a separate explicit key and never browser XFF.
  if (env.VERCEL !== '1' || !key || Buffer.byteLength(key) < 32 || !ip || !isIP(ip)) return {}
  if (isIP(ip)===6) ip=new URL(`http://[${ip}]/`).hostname.slice(1,-1)
  const stamp = String(Math.floor(Date.now() / 1000))
  const requestId = randomBytes(16).toString('hex')
  const message = JSON.stringify(['vesconte.ip.v1', ip, stamp, method, path, requestId])
    .replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
  const signature = createHmac('sha256', key).update(message, 'ascii').digest('hex')
  return { 'X-Vesconte-Client-IP': ip, 'X-Vesconte-IP-Timestamp': stamp,
    'X-Vesconte-IP-Request-ID': requestId, 'X-Vesconte-IP-Signature': signature }
}

