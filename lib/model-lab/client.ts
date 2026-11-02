import { ModelLabError, errorFromStatus, MODEL_LAB_ERROR_MESSAGES, type ModelLabErrorCode } from './contract'

type Options = { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; idempotencyKey?: string; signal?: AbortSignal }

const CODES = Object.keys(MODEL_LAB_ERROR_MESSAGES) as ModelLabErrorCode[]

/**
 * The browser's only way to the Model Lab: the local `/api/model-lab/*` route. It
 * throws `ModelLabError`, so a component can show the same message a page would.
 */
export async function labFetch<T>(path: string, options: Options = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/model-lab/${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      cache: 'no-store',
      credentials: 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ModelLabError('upstream')
  }
  if (!response.ok) {
    const retry = response.headers.get('Retry-After')
    const retryAfter = retry && /^\d{1,9}$/.test(retry) ? Number(retry) : null
    let code: ModelLabErrorCode | null = null
    try {
      const json = (await response.json()) as { error?: unknown }
      if (typeof json.error === 'string' && (CODES as string[]).includes(json.error)) code = json.error as ModelLabErrorCode
    } catch {
      /* the status alone decides */
    }
    throw code ? new ModelLabError(code, retryAfter) : errorFromStatus(response.status, retryAfter)
  }
  try {
    return (await response.json()) as T
  } catch {
    throw new ModelLabError('upstream')
  }
}

export function describeError(error: unknown): string {
  return error instanceof ModelLabError ? error.message : MODEL_LAB_ERROR_MESSAGES.upstream
}

/** A fresh key for one submission; reuse the same key when retrying that submission. */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return `lab-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}
