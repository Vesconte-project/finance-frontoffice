import { BarChart3, Eye, ShieldCheck, Target, TrendingUp, UserRound } from 'lucide-react'
import {
  CircleHighlight,
  GlassPanel,
  HandScript,
  MarketingPageOutro,
  MarketingPageShell,
  ScribbleNote,
  SectionHeading,
} from '@/components/marketing/site-chrome'

const principles = [
  {
    title: 'Clarity',
    body: 'The product is designed to reduce market noise into one weekly decision.',
    icon: Eye,
  },
  {
    title: 'Discipline',
    body: 'Rules and cadence matter more than opinions and constant commentary.',
    icon: Target,
  },
  {
    title: 'Risk awareness',
    body: 'The system exists to manage participation, not to maximize thrill.',
    icon: ShieldCheck,
  },
  {
    title: 'Consistency',
    body: 'The same process is applied through bull markets, crashes, and chop.',
    icon: TrendingUp,
  },
] as const

export default function AboutPage() {
  return (
    <MarketingPageShell
      activeHref="/about"
      eyebrow="About"
      title={
        <>
          Built for investors
          <br />
          who want one clean
          <br />
          <span className="text-[var(--text)]">weekly read on SPY.</span>
        </>
      }
      description="Vesconte exists for one kind of person: someone who wants a clear weekly read on SPY and a calm room to think it through — not another feed to keep up with."
      primaryCta={{ label: 'Explore the product', href: '/product' }}
      secondaryCta={{ label: 'Read the methodology', href: '/product#methodology' }}
      heroAside={
        <GlassPanel className="p-7">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--text)] dark:text-[var(--text)]">Who this is for</p>
          <div className="mt-5 grid gap-3">
            {['Investors who want a system', 'People who value calmer execution', 'Users who prefer one clear signal'].map((item) => (
              <div key={item} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold dark:border-[var(--line)] dark:bg-[var(--surface)]">
                {item}
              </div>
            ))}
          </div>
          <CircleHighlight className="mt-6" tone="orange">
            <HandScript className="text-[2.15rem] leading-none text-[var(--down)]">Built for clarity.</HandScript>
          </CircleHighlight>
          <ScribbleNote className="mt-6" tone="blue">
            Clear signal.
            <br />
            Cleaner week.
          </ScribbleNote>
        </GlassPanel>
      }
    >
      <section className="mx-auto max-w-[1280px] px-6 py-20 sm:px-10 lg:px-16">
        <SectionHeading
          eyebrow="Principles"
          title="The product exists to simplify the decision layer."
          body="Vesconte is intentionally narrow. It is not trying to be a social feed, a charting suite, or an alert explosion."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {principles.map((item) => {
            const Icon = item.icon
            return (
              <GlassPanel key={item.title} className="p-6">
                <div className="grid size-12 place-items-center rounded-md bg-[var(--bg)]/12 text-[var(--bg)] dark:bg-[var(--surface)] dark:text-[var(--bg)]">
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-6 text-2xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-base leading-7 text-[var(--text-muted)] dark:text-[var(--text)]">{item.body}</p>
              </GlassPanel>
            )
          })}
        </div>
      </section>

      <section className="border-y border-[var(--line)] bg-[var(--surface)] dark:border-[var(--line)] dark:bg-[var(--surface)]">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-6 py-20 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-16">
          <div>
            <SectionHeading
              eyebrow="The lounge"
              title="A room, not a feed."
              body="The lounge is a small group reading the same tape every week — structure, cadence, and a second opinion when you want one, without the noise of an endless timeline."
            />
            <HandScript className="mt-5 block text-[2.15rem] leading-none text-[var(--text)] dark:text-[var(--text)]">
              One clean weekly read.
            </HandScript>
          </div>
          <GlassPanel className="grid gap-5 p-7 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 dark:border-[var(--line)] dark:bg-[var(--surface)]">
              <UserRound className="size-6 text-[var(--text)] dark:text-[var(--text)]" />
              <h3 className="mt-4 text-lg font-semibold">For disciplined users</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] dark:text-[var(--text)]">People who want structure around exposure, not endless opinion streams.</p>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-5 dark:border-[var(--line)] dark:bg-[var(--surface)]">
              <BarChart3 className="size-6 text-[var(--text)] dark:text-[var(--text)]" />
              <h3 className="mt-4 text-lg font-semibold">Not for overtrading</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)] dark:text-[var(--text)]">If someone wants constant intraday prompts, this is the wrong shape of product.</p>
            </div>
          </GlassPanel>
        </div>
      </section>

      <MarketingPageOutro />
    </MarketingPageShell>
  )
}
