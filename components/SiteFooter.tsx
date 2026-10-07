import Link from 'next/link'
import { BRAND_NAME, FOOTER_LINKS } from '@/components/marketing/site-config'

export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      data-analytics-surface="site_footer"
      className="site-footer relative isolate z-[60] mt-auto border-t border-border bg-[var(--page-bg)] text-content-secondary"
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-5 py-12 md:px-10">
        <div>
          <Link href="/" className="marketing-logo-type text-lg text-content-primary">{BRAND_NAME}</Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-content-secondary">
            Market signals, research, watchlists, and alerts in one workspace.
          </p>
        </div>
        <div className="flex flex-col gap-4 border-t border-border pt-6 text-xs md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-3">
            {FOOTER_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-content-primary">
                {item.label}
              </Link>
            ))}
          </nav>
          <span>© {year} {BRAND_NAME}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
