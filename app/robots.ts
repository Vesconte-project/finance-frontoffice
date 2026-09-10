import type { MetadataRoute } from 'next'

function resolveBaseOrigin(rawUrl: string | undefined): string {
  const fallback = 'https://vesconte.vercel.app'
  if (!rawUrl) return fallback

  const trimmed = rawUrl.trim()
  if (!trimmed) return fallback

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    return new URL(withScheme).origin
  } catch {
    return fallback
  }
}

export default function robots(): MetadataRoute.Robots {
  const origin = resolveBaseOrigin(process.env.NEXT_PUBLIC_APP_URL)

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
