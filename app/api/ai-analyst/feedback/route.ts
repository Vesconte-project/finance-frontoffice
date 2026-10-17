import { NextResponse } from 'next/server'
import { getViewerUserId } from '@/lib/auth'
import { personalFailure } from '@/lib/personal-server'
import { recordAiResearchFeedback } from '@/lib/ai-research'

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(request: Request) {
  const userId = await getViewerUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const category = asString(payload.category)
  const note = asString(payload.note)
  const runId = typeof payload.runId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(payload.runId) ? payload.runId : null

  if (!runId || Object.keys(payload).some(key => !['runId', 'category', 'note'].includes(key))) {
    return NextResponse.json({ error: 'A saved run is required.' }, { status: 400 })
  }

  if (!category) {
    return NextResponse.json({ error: 'category is required.' }, { status: 400 })
  }

  try {
    await recordAiResearchFeedback({ runId, category, note })
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return personalFailure(error)
  }
}
