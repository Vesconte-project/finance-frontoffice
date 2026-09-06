'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/marketing/site-chrome'

// Full-screen routes render their own site header (the market atlas floats the
// compact pill over the map).
const FULLSCREEN_ROUTES = new Set<string>(['/markets/network'])

export default function NavRouteAware() {
  const pathname = usePathname()
  if (pathname && FULLSCREEN_ROUTES.has(pathname)) return null
  return <SiteHeader activeHref={pathname} />
}
