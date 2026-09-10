import type { Instrumentation } from 'next'
import { logServerEvent } from '@/lib/observability/vercel-log'

/**
 * Server errors as structured Vercel log lines, so a spike in a specific route
 * is filterable next to the usage events from the same route.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err)
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined

  logServerEvent(
    'request_error',
    {
      message,
      digest,
      path: request.path,
      method: request.method,
      router: context.routerKind,
      route: context.routePath,
      route_type: context.routeType,
      rendering: context.renderSource,
      revalidate: context.revalidateReason,
    },
    'error'
  )
}
