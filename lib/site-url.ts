/**
 * The public URL this deployment serves from.
 *
 * Resolved in this order:
 *
 *  1. `NEXT_PUBLIC_APP_URL`, the explicit configuration, which wins whenever it
 *     is set to something usable.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets on every deployment,
 *     previews included. It resolves to the shortest production custom domain,
 *     or to the `.vercel.app` domain when there is no custom one, and it follows
 *     a project rename. It carries no protocol scheme, so one is added here.
 *  3. `localhost`, which is the only case left once neither of the above is
 *     present, and is visibly wrong in production rather than quietly wrong.
 *
 * A hardcoded production domain was the previous fallback. It went stale the
 * moment the Vercel project was renamed, and a stale value here is not a
 * harmless default: it is the origin printed into `robots.txt` and every
 * `sitemap.xml` entry, so it points crawlers at a domain nobody serves.
 */

const LOCAL_FALLBACK = 'http://localhost:3000'

function candidates(): string[] {
  const configured = process.env.NEXT_PUBLIC_APP_URL
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return [configured, vercelProduction, LOCAL_FALLBACK].filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )
}

function parse(value: string): URL | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

function resolve(): URL {
  for (const candidate of candidates()) {
    const parsed = parse(candidate)
    if (parsed) return parsed
  }
  // Unreachable in practice: LOCAL_FALLBACK always parses.
  return new URL(LOCAL_FALLBACK)
}

/** Scheme and host only. Use where a bare origin is required, such as robots `host`. */
export function siteOrigin(): string {
  return resolve().origin
}

/** Origin plus any base path, without a trailing slash. Use to build absolute URLs. */
export function siteBaseUrl(): string {
  const parsed = resolve()
  return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`
}
