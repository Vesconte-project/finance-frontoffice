import { fetchBackendResponse, BackendDataError } from '@/lib/backend'
import { getViewerAccess } from '@/lib/billing'
import { PlatformError } from '@/lib/platform-client'
import { exportTicker, TickerExportError } from '@/lib/ticker-export'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  return exportTicker(request, ticker, {
    access: async () => {
      try { return await getViewerAccess() }
      catch (error) {
        if (error instanceof PlatformError && error.status === 401) throw new TickerExportError(401, 'Sign in again to export data.')
        if (error instanceof PlatformError && error.status === 403) throw new TickerExportError(403, 'Your account cannot export this data.')
        throw new TickerExportError(503, 'Your access could not be checked. Try again later.')
      }
    },
    read: async (path, signal) => {
      try { return await fetchBackendResponse(path, { context: 'ticker.csv-export', timeoutMs: 15000, init: { signal } }) }
      catch (error) {
        if (error instanceof BackendDataError && error.status === 401) throw new TickerExportError(401, 'Sign in again to export data.')
        throw error
      }
    },
  })
}
