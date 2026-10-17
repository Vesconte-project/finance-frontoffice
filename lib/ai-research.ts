import 'server-only'
import { personalRequest } from './personal-server'

type SignalDirection = 'bullish' | 'neutral' | 'bearish'
type ResearchRunStatus = 'started' | 'completed' | 'failed'

type CreateAiResearchRunInput = {
  ticker: string
  promptLabel: string | null
  question: string | null
  signal: {
    direction: SignalDirection
    conviction: number | null
    predictionHorizon: number | null
    signalDate: string | null
  }
}

type FinalizeAiResearchRunInput = {
  runId: string
  status: 'completed' | 'failed'
  provider: string | null
  model: string | null
  responseExcerpt?: string | null
  citations?: string[]
  errorMessage?: string | null
}

type RecordAiResearchFeedbackInput = {
  runId: string
  category: string
  note: string | null
}

type GetRecentAiResearchRunsInput = {
  ticker?: string | null
  limit?: number
}

type GetAiResearchRunByIdInput = {
  runId: string
}

export type AiResearchRun = {
  id: string
  ticker: string
  promptLabel: string | null
  question: string | null
  signalDirection: SignalDirection
  conviction: number | null
  predictionHorizon: number | null
  signalDate: string | null
  provider: string | null
  model: string | null
  status: ResearchRunStatus
  responseExcerpt: string | null
  citations: string[]
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase()
}

export async function createAiResearchRun(input: CreateAiResearchRunInput): Promise<string> {
  const payload = await (await personalRequest('/ai-research/runs', { method: 'POST', body: input })).json() as { runId: string }
  return payload.runId
}

export async function finalizeAiResearchRun({ runId, ...body }: FinalizeAiResearchRunInput): Promise<void> {
  await personalRequest(`/ai-research/runs/${runId}`, { method: 'PATCH', body })
}

export async function recordAiResearchFeedback(input: RecordAiResearchFeedbackInput): Promise<{ ok: boolean }> {
  return (await personalRequest('/ai-research/feedback', { method: 'POST', body: input })).json()
}

export async function getRecentAiResearchRuns(input: GetRecentAiResearchRunsInput = {}): Promise<AiResearchRun[]> {
  const params = new URLSearchParams()
  if (input.ticker) params.set('ticker', normalizeTicker(input.ticker))
  params.set('limit', String(Math.max(1, Math.min(input.limit ?? 5, 20))))
  const payload = await (await personalRequest(`/ai-research/runs?${params}`)).json() as { runs: AiResearchRun[] }
  return payload.runs
}

export async function getAiResearchRunById({ runId }: GetAiResearchRunByIdInput): Promise<AiResearchRun> {
  const payload = await (await personalRequest(`/ai-research/runs/${runId}`)).json() as { run: AiResearchRun }
  return payload.run
}
