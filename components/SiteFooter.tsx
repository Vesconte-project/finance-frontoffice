import Link from 'next/link'
import { Caveat } from 'next/font/google'
import { ArrowUpRight } from 'lucide-react'
import {
  BRAND_NAME,
  BRAND_SHORT_MARK,
  BRAND_WORDMARK,
  CONTACT_EMAIL,
  FOOTER_SECONDARY_LINKS,
  MARKETING_NAV_ITEMS,
} from '@/components/marketing/site-config'
import FooterBrandReveal from '@/components/FooterBrandReveal'

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
})

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
            <p className={`${caveat.className} text-[1.7rem] leading-none text-brand-spark-soft`}>
              Research with context.
            </p>
            <h2 className="mt-3 max-w-md text-3xl font-black tracking-tight text-content-primary">
              A clearer way to explore the market.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              data-analytics-id="footer_sign_up"
              data-analytics-event="auth_start"
              data-analytics-intent="sign_up"
              className="inline-flex h-12 items-center justify-center rounded-full bg-content-primary px-6 text-sm font-semibold text-[var(--page-bg)] transition hover:scale-[1.02]"
            >
              Create an account
            </Link>
            <a
              href={askHref}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-surface-elevated px-6 text-sm font-semibold text-content-primary transition hover:border-brand-spark hover:text-brand-spark"
            >
              Contact the team
              <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-7 md:flex-row md:items-start md:justify-between">
          <div>
            <Link href="/" className="marketing-logo-type flex items-center gap-3 text-lg font-semibold text-content-primary">
              <span>{BRAND_SHORT_MARK}</span>
              <span className="text-brand-spark">/</span>
              <span>{BRAND_WORDMARK}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-content-secondary">
              Market signals, research, watchlists, and alerts in one workspace.
            </p>
            <p className={`${caveat.className} mt-4 text-3xl leading-none text-brand-spark-soft`}>
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

        <div className="overflow-hidden pt-6 text-content-primary">
          <FooterBrandReveal />
        </div>
      </div>
    </footer>
  )
}
