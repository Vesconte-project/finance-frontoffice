import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import {
  BRAND_NAME,
  CONTACT_EMAIL,
  FOOTER_SECONDARY_LINKS,
  MARKETING_NAV_ITEMS,
} from '@/components/marketing/site-config'
import AccountEntryLink from '@/components/AccountEntryLink'

export default function SiteFooter() {
  const year = new Date().getFullYear()
  const askHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('A question about Vesconte')}`

  return (
    <footer
      data-analytics-surface="site_footer"
      className="site-footer relative isolate z-[60] mt-auto border-t border-border bg-[var(--page-bg)] text-content-secondary"
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-10 px-5 py-12 md:px-10">
        <div className="flex flex-col gap-6 border-b border-border pb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[1.7rem] leading-none text-content-secondary">
              Research with context.
            </p>
            <h2 className="mt-3 max-w-md text-3xl font-black tracking-tight text-content-primary">
              A clearer way to explore the market.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <AccountEntryLink
              signedOutLabel="Create an account"
              signedInLabel="Open workspace"
              analyticsId="footer_sign_up"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--btn-primary-bg)] px-6 text-sm font-medium text-[var(--btn-primary-fg)] transition"
            />
            <a
              href={askHref}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[var(--text)] bg-transparent px-6 text-sm font-medium text-[var(--text)] transition focus-visible:border-[var(--accent)]"
            >
              Contact the team
              <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/" className="marketing-logo-type text-lg text-content-primary">{BRAND_NAME}</Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-content-secondary">
              Market signals, research, watchlists, and alerts in one workspace.
            </p>
            <p className="mt-4 text-3xl leading-none text-content-secondary">
              Follow the signal.
            </p>
          </div>
          <nav className="flex max-w-[34rem] flex-wrap gap-x-6 gap-y-3 text-sm text-content-secondary">
            {MARKETING_NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-content-primary">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-4 border-t border-border pt-6 text-xs md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-7">
            {FOOTER_SECONDARY_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-content-primary">
                {item.label}
              </Link>
            ))}
          </div>
          <span>© {year} {BRAND_NAME}. All rights reserved.</span>
        </div>

      </div>
    </footer>
  )
}
