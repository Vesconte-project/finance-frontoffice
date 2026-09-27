import Link from 'next/link'
import { Sora } from 'next/font/google'
import { ArrowLeft } from 'lucide-react'
import { BRAND_DESCRIPTION, BRAND_NAME } from '@/components/marketing/site-config'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700'], display: 'swap', variable: '--font-auth-display' })

type AuthLayoutProps = {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={`auth-page ${sora.variable}`}>
      <main className="auth-page__shell">
        <nav className="auth-page__nav" aria-label="Account navigation">
          <Link href="/" className="auth-page__brand" aria-label={`${BRAND_NAME} home`}>
            {BRAND_NAME}<span aria-hidden="true">/</span>
          </Link>
          <Link href="/" className="auth-page__home-link">
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.8} />
            <span>Back to home</span>
          </Link>
        </nav>

        <div className="auth-page__content">
          <section className="auth-page__story" aria-labelledby="auth-story-heading">
            <div className="auth-page__story-copy">
              <h1 id="auth-story-heading">A clearer way to explore the market.</h1>
              <p>{BRAND_DESCRIPTION}</p>
            </div>

            <svg className="auth-page__network" viewBox="0 0 640 490" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
              <g stroke="currentColor" strokeWidth="1">
                <path d="M-12 322 104 248 204 309 310 181 414 228 530 113 664 160" />
                <path d="M40 92 104 248 245 102 310 181 495 354 664 317" />
                <path d="M104 248 204 309 366 389 495 354 530 113" />
                <path d="M245 102 414 228 495 354" />
                <path d="M310 181 366 389 530 113" />
              </g>
              <g fill="currentColor">
                <circle cx="40" cy="92" r="3" /><circle cx="104" cy="248" r="5" />
                <circle cx="204" cy="309" r="3" /><circle cx="245" cy="102" r="4" />
                <circle cx="310" cy="181" r="6" /><circle cx="366" cy="389" r="3" />
                <circle cx="414" cy="228" r="4" /><circle cx="495" cy="354" r="5" />
                <circle cx="530" cy="113" r="4" />
              </g>
            </svg>

            <p className="auth-page__story-signoff">Nothing moves alone.</p>
          </section>

          <section className="auth-page__form" aria-label="Account access">
            <div className="auth-page__form-inner">{children}</div>
          </section>
        </div>
      </main>
    </div>
  )
}
