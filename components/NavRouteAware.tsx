'use client'

import { usePathname } from 'next/navigation'
import { SiteHeader } from '@/components/marketing/site-chrome'

export default function NavRouteAware() {
  const pathname = usePathname()
  return <SiteHeader activeHref={pathname} />
}
