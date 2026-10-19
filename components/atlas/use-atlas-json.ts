'use client'

import { useEffect, useState } from 'react'
import { atlasDenial, type AtlasDenial } from '@/lib/atlas-model'

/** One local atlas route's answer, as the screen needs to tell its states apart. */
export type Remote<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'denied'; reason: AtlasDenial }
  | { status: 'invalid' }
  | { status: 'error' }

/** Reads a local atlas route; never throws, a refusal keeps its reason. */
export async function fetchAtlasJson<T>(path: string, parse: (value: unknown) => T | null, init?: RequestInit): Promise<Remote<T>> {
  try {
    const response = await fetch(path, init)
    const body: unknown = await response.json().catch(() => null)
    if (response.status === 403) {
      const reason = atlasDenial(body)
      return reason ? { status: 'denied', reason } : { status: 'error' }
    }
    if (response.status === 422) return { status: 'invalid' }
    const data = response.ok ? parse(body) : null
    return data ? { status: 'ok', data } : { status: 'error' }
  } catch {
    return init?.signal?.aborted ? { status: 'idle' } : { status: 'error' }
  }
}

/** A local route read while `path` is set; changing the path reads again, `null` goes idle. */
export function useAtlasJson<T>(path: string | null, parse: (value: unknown) => T | null): [Remote<T>, () => void] {
  const [state, setState] = useState<{ key: string | null; value: Remote<T> }>({ key: null, value: { status: 'idle' } })
  const [attempt, setAttempt] = useState(0)
  const key = path === null ? null : `${path}#${attempt}`
  useEffect(() => {
    if (path === null || key === null) return
    const controller = new AbortController()
    fetchAtlasJson(path, parse, { signal: controller.signal }).then((value) => {
      if (!controller.signal.aborted) setState({ key, value })
    })
    return () => controller.abort()
    // `parse` is a module-level reader; the path alone decides what is read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const value: Remote<T> = path === null ? { status: 'idle' } : state.key === key ? state.value : { status: 'loading' }
  return [value, () => setAttempt((count) => count + 1)]
}
