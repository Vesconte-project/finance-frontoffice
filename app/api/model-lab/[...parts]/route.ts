import { NextRequest, NextResponse } from 'next/server'
import { handleModelLabRequest, type BffMethod } from '@/lib/model-lab/bff'
import { ModelLabError, MODEL_LAB_ERROR_MESSAGES, statusFromError } from '@/lib/model-lab/contract'
import { openModelLab } from '@/lib/model-lab/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 65536
const HEADERS = { 'Cache-Control': 'private, no-store' }

function failure(error: ModelLabError) {
  return NextResponse.json({ error: error.code, message: MODEL_LAB_ERROR_MESSAGES[error.code] }, {
    status: statusFromError(error),
    headers: { ...HEADERS, ...(error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) },
  })
}

async function readBody(request: NextRequest): Promise<unknown> {
  if (request.method === 'GET') return undefined
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  if (reader) {
    for (;;) {
      const item = await reader.read()
      if (item.done) break
      size += item.value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new ModelLabError('invalid')
      }
      chunks.push(item.value)
    }
  }
  if (!size) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ModelLabError('invalid')
  }
}

async function route(request: NextRequest, context: { params: Promise<{ parts: string[] }> }) {
  try {
    const { parts } = await context.params
    const body = await readBody(request)
    const { source } = await openModelLab()
    const result = await handleModelLabRequest(source, {
      method: request.method as BffMethod,
      parts,
      body,
      idempotencyKey: request.headers.get('idempotency-key'),
    })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: { ...HEADERS, ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}) },
    })
  } catch (error) {
    return failure(error instanceof ModelLabError ? error : new ModelLabError('upstream'))
  }
}

export { route as GET, route as POST, route as PATCH }
