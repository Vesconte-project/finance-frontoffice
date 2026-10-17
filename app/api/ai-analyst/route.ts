import { NextRequest, NextResponse } from 'next/server'
import { getViewerUserId } from '@/lib/auth'
import { personalFailure } from '@/lib/personal-server'
import { createAiResearchRun, finalizeAiResearchRun } from '@/lib/ai-research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'

type AnalystSignalInput = {
  direction?: unknown
  conviction?: unknown
  predictionHorizon?: unknown
  signalDate?: unknown
}

type AnalystNewsInput = {
  title?: unknown
  publisher?: unknown
  publishedAt?: unknown
  url?: unknown
}

function errorMessage(error: unknown): string {
  void error
  return 'AI request failed.'
}

function mergeUniqueUrls(existing: string[], incoming: unknown): string[] {
  const next = new Set(existing)
  if (Array.isArray(incoming)) {
    for (const item of incoming) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (!/^https?:\/\//.test(trimmed) || trimmed.length > 2048) continue
      if (next.size < 32) next.add(trimmed)
    }
  }
  return [...next]
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asDirection(value: unknown): SignalDirection | null {
  if (value !== 'bullish' && value !== 'neutral' && value !== 'bearish') return null
  return value
}

function asConviction(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0 || value > 1) return null
  return value
}

function asHorizon(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded <= 0) return null
  return rounded
}

function normalizeTicker(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  const ticker = raw.toUpperCase()
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) return null
  return ticker
}

function sanitizeNews(items: unknown): Array<{
  title: string
  publisher: string
  publishedAt: string | null
  url: string
}> {
  if (!Array.isArray(items)) return []

  const sanitized: Array<{
    title: string
    publisher: string
    publishedAt: string | null
    url: string
  }> = []

  for (const item of items) {
    const row = item as AnalystNewsInput
    const title = asString(row?.title)
    const publisher = asString(row?.publisher) ?? 'Unknown publisher'
    const publishedAt = asString(row?.publishedAt)
    const url = asString(row?.url)
    if (!title || !url || !url.startsWith('http')) continue
    sanitized.push({ title, publisher, publishedAt, url })
    if (sanitized.length >= 8) break
  }

  return sanitized
}

function buildPrompt({
  ticker,
  signal,
  news,
  question,
  promptLabel,
}: {
  ticker: string
  signal: {
    direction: SignalDirection
    conviction: number | null
    predictionHorizon: number | null
    signalDate: string | null
  }
  news: Array<{
    title: string
    publisher: string
    publishedAt: string | null
    url: string
  }>
  question: string | null
  promptLabel: string | null
}): string {
  const conviction =
    signal.conviction === null ? 'unknown conviction' : `${Math.round(signal.conviction * 100)}% conviction`
  const horizon =
    signal.predictionHorizon === null
      ? 'unspecified horizon'
      : `${signal.predictionHorizon}-day prediction horizon`
  const signalDate = signal.signalDate ?? 'recent session'

  const headlineContext = news
    .map((item, index) => {
      const publishedAt = item.publishedAt ?? 'unknown time'
      return `${index + 1}. ${item.title} | ${item.publisher} | ${publishedAt} | ${item.url}`
    })
    .join('\n')

  const requestLine = question ?? 'What are the main catalysts behind the current model stance?'

  return [
    `Ticker: ${ticker}`,
    `Signal: ${signal.direction.toUpperCase()} (${conviction}, ${horizon}, date ${signalDate})`,
    promptLabel ? `Prompt label: ${promptLabel}` : null,
    `User question: ${requestLine}`,
    '',
    'Recent headlines:',
    headlineContext || 'No headlines provided.',
    '',
    'Task:',
    'Write exactly 3 concise bullet points answering the user question and explaining plausible catalysts behind this model stance.',
    'Rules:',
    '- Focus on macro, sector, company, rates, and flow dynamics.',
    '- Mention uncertainty when evidence is mixed.',
    '- Keep each bullet under 38 words.',
    '- Do not provide investment advice.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')
}

export async function POST(request: NextRequest) {
  if (!await getViewerUserId()) return NextResponse.json({ error: 'Authentication required.' },
    { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim()
  const model = process.env.PERPLEXITY_MODEL?.trim() || 'sonar-pro'

  if (!apiKey) {
    return NextResponse.json(
      { error: 'PERPLEXITY_API_KEY is not configured on the server.' },
      { status: 503 }
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const ticker = normalizeTicker(payload.ticker)
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required.' }, { status: 400 })
  }

  const signalInput = (payload.signal ?? {}) as AnalystSignalInput
  const direction = asDirection(signalInput.direction)
  if (!direction) {
    return NextResponse.json({ error: 'signal.direction is required.' }, { status: 400 })
  }

  const signal = {
    direction,
    conviction: asConviction(signalInput.conviction),
    predictionHorizon: asHorizon(signalInput.predictionHorizon),
    signalDate: asString(signalInput.signalDate),
  }
  const news = sanitizeNews(payload.news)
  const question = asString(payload.question)
  const promptLabel = asString(payload.promptLabel)
  let runId: string
  try {
    runId = await createAiResearchRun({
    ticker,
    promptLabel,
    question,
    signal,
    })
  } catch (error) {
    return personalFailure(error)
  }

  const body = {
    model,
    stream: true,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'You are an elite quantitative market analyst. Use web-aware reasoning grounded in cited sources and keep output concise.',
      },
      {
        role: 'user',
        content: buildPrompt({ ticker, signal, news, question, promptLabel }),
      },
    ],
  }

  let upstream: Response
  try {
    upstream = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    await finalizeAiResearchRun({
      runId,
      status: 'failed',
      provider: 'perplexity',
      model,
      errorMessage: 'Failed to reach Perplexity API.',
    })
    return NextResponse.json({ error: 'Failed to reach Perplexity API.' }, { status: 502 })
  }

  if (!upstream.ok) {
    await finalizeAiResearchRun({
      runId,
      status: 'failed',
      provider: 'perplexity',
      model,
      errorMessage: `Perplexity API error ${upstream.status}`,
    })
    return NextResponse.json(
      {
        error: 'Perplexity API error.',
        status: upstream.status,
      },
      { status: 502 }
    )
  }

  if (!upstream.body) {
    await finalizeAiResearchRun({
      runId,
      status: 'failed',
      provider: 'perplexity',
      model,
      errorMessage: 'Perplexity API returned an empty stream.',
    })
    return NextResponse.json({ error: 'Perplexity API returned an empty stream.' }, { status: 502 })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = upstream.body.getReader()
  let buffer = ''
  let accumulated = ''
  let gatheredCitations: string[] = []

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ run_id: runId })}\n\n`))

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue

          controller.enqueue(value)
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split(/\r?\n\r?\n/)
          buffer = events.pop() || ''

          for (const eventBlock of events) {
            const lines = eventBlock
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.startsWith('data:'))

            for (const line of lines) {
              const payload = line.slice(5).trim()
              if (!payload || payload === '[DONE]') continue

              let parsed: Record<string, unknown>
              try {
                parsed = JSON.parse(payload) as Record<string, unknown>
              } catch {
                continue
              }

              const choices = Array.isArray(parsed.choices) ? parsed.choices : []
              const firstChoice = (choices[0] as Record<string, unknown> | undefined) ?? null
              const delta = (firstChoice?.delta as Record<string, unknown> | undefined) ?? null
              const message = (firstChoice?.message as Record<string, unknown> | undefined) ?? null

              const deltaContent = typeof delta?.content === 'string' ? delta.content : null
              const messageContent = typeof message?.content === 'string' ? message.content : null
              const contentChunk = deltaContent ?? (accumulated.length === 0 ? messageContent : null)

              if (contentChunk && accumulated.length < 4000) {
                accumulated = `${accumulated}${contentChunk}`.slice(0, 4000)
              }

              gatheredCitations = mergeUniqueUrls(gatheredCitations, parsed.citations)
            }
          }
        }

        await finalizeAiResearchRun({
          runId,
          status: 'completed',
          provider: 'perplexity',
          model,
          responseExcerpt: accumulated.trim() || null,
          citations: gatheredCitations,
        })
        controller.close()
      } catch (error) {
        controller.error(error)

        await finalizeAiResearchRun({
          runId,
          status: 'failed',
          provider: 'perplexity',
          model,
          responseExcerpt: accumulated.trim() || null,
          citations: gatheredCitations,
          errorMessage: errorMessage(error),
        })
      }
    },
    async cancel() {
      await reader.cancel()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, no-transform',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
