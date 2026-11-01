import { retryDelayMs } from './retry-policy'

type Options = {
  runtime: 'browser' | 'server'
  fetcher?: typeof fetch
  wait?: (ms: number, signal?: AbortSignal | null) => Promise<void>
  now?: () => number
  random?: () => number
}

function waitForRetry(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const aborted = () => { clearTimeout(timer); reject(signal?.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', aborted); resolve() }, ms)
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

/** Bounded GET-only retries. Mutations and SSR are always single-attempt. */
export function createReadClient({ runtime, fetcher = fetch, wait = waitForRetry, now = Date.now, random = Math.random }: Options) {
  // Only identical reads without a caller-owned cancellation signal are coalesced.
  // Responses are cloned, so each reader owns its body. Nothing persists after settling.
  const inFlight = new Map<string, Promise<Response>>()
  return async function read(path: string, init: RequestInit = {}): Promise<Response> {
    const retryable = runtime === 'browser' && (!init.method || init.method.toUpperCase() === 'GET')
    const key = retryable && !init.signal ? JSON.stringify([path, init, [...new Headers(init.headers)]]) : null
    if (key && inFlight.has(key)) return (await inFlight.get(key)!).clone()
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        init.signal?.throwIfAborted()
        const response = await fetcher(path, init)
        if (!retryable || ![429, 503].includes(response.status) || attempt >= 2) return response
        const delay = retryDelayMs(attempt, response.headers.get('Retry-After'), now(), random)
        // Do not keep timers alive for hour/day quotas. Let the UI show the refusal.
        if (delay > 30000) return response
        await response.body?.cancel()
        await wait(delay, init.signal)
      }
    }
    const pending = run()
    if (key) inFlight.set(key, pending)
    try { return (await pending).clone() }
    finally { if (key) inFlight.delete(key) }
  }
}

export const browserRead = createReadClient({ runtime: typeof window === 'undefined' ? 'server' : 'browser' })
