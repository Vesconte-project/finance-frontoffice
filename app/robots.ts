import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/lib/site-url'
import { crawlRules } from '@/lib/crawl-policy'

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()
  return { rules: crawlRules(), sitemap: `${origin}/sitemap.xml`, host: origin }
}
