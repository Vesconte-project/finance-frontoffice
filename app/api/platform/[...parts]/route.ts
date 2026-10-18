import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { createPlatformClient, PlatformError } from '@/lib/platform-client'
import { backendOriginHeaders } from '@/lib/backend-origin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function proxy(request: NextRequest, context: { params: Promise<{ parts: string[] }> }) {
  const session = await auth()
  if (!session.userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401,
    headers: { 'Cache-Control': 'private, no-store' } })
  try {
    const { parts } = await context.params
    // The shared native client admits only the closed native contract below.
    const path = '/' + parts.map(encodeURIComponent).join('/') + request.nextUrl.search
    let body: unknown
    if (request.method !== 'GET') {
      const reader = request.body?.getReader()
      let size = 0
      const chunks: Uint8Array[] = []
      if (reader) {
        while (true) {
          const item = await reader.read()
          if (item.done) break
          size += item.value.byteLength
          if (size > 65536) { await reader.cancel(); throw new PlatformError(413) }
          chunks.push(item.value)
        }
      }
      if (size) body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
    const client = createPlatformClient({ baseUrl: process.env.BACKEND_BASE_URL || '',
      getToken: options => session.getToken(options?.skipCache ? { expiresInSeconds: 60 } : undefined),
      originHeaders: backendOriginHeaders })
    const upstream = await client(path, { method: request.method as 'GET' | 'POST' | 'PATCH' | 'DELETE', body,
      idempotencyKey: request.headers.get('idempotency-key') || undefined })
    return new NextResponse(upstream.body, { status: upstream.status, headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : error instanceof SyntaxError ? 422 : 502
    return NextResponse.json({ error: 'Platform request refused or unavailable' }, { status,
      headers: { 'Cache-Control': 'private, no-store', ...(error instanceof PlatformError && error.retryAfter
        ? { 'Retry-After': String(error.retryAfter) } : {}) } })
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE }
