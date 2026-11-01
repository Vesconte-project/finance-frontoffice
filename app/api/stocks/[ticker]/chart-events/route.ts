import { chartEventsResponse } from '@/lib/chart-events'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(_request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  return chartEventsResponse((await params).ticker.trim().toUpperCase())
}
