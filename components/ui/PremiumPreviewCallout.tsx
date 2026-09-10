import { Lock } from 'lucide-react'
import Card from '@/components/ui/Card'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'

type PremiumPreviewCalloutProps = {
  title: string
  description: string
  details?: string
  ctaHref: string
  ctaLabel: string
  openInNewTab?: boolean
  className?: string
  /** Names this gate in telemetry, so prompt views and CTA clicks can be paired. */
  analyticsId?: string
}

export default function PremiumPreviewCallout({
  title,
  description,
  details,
  ctaHref,
  ctaLabel,
  openInNewTab = false,
  className,
  analyticsId = 'premium_preview',
}: PremiumPreviewCalloutProps) {
  return (
    <Card className={className ?? 'section-gap text-center'}>
      <TrackEventOnMount eventName="upgrade_prompt_shown" payload={{ control: analyticsId }} />
      <div className="text-caption inline-flex w-fit items-center gap-2 self-center rounded-[var(--radius-pill)] border border-primary/30 bg-primary/10 px-3 py-1 text-primary">
        <Lock className="h-3.5 w-3.5" />
        Premium Preview
      </div>
      <h3 className="text-card-title text-content-primary">{title}</h3>
      <p className="text-body">{description}</p>
      {details ? <p className="text-caption text-content-muted">{details}</p> : null}
      <div>
        <a
          href={ctaHref}
          data-analytics-id={`${analyticsId}_cta`}
          data-analytics-gate={analyticsId}
          target={openInNewTab ? '_blank' : undefined}
          rel={openInNewTab ? 'noopener noreferrer' : undefined}
          className="state-interactive inline-flex items-center justify-center rounded-[var(--radius-md)] border border-transparent bg-primary px-[18px] py-[12px] text-label-lg text-primary-foreground hover:bg-[var(--accent-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
        >
          {ctaLabel}
        </a>
      </div>
    </Card>
  )
}

