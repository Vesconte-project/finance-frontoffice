import Card from '@/components/ui/Card'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'

type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  headingLevel?: 'h1' | 'h2' | 'h3'
  /**
   * Names this empty state in telemetry. Set it wherever reaching the state is
   * a product signal rather than an ordinary render.
   */
  analyticsId?: string
}

export default function EmptyState({
  title,
  description,
  action,
  className,
  headingLevel = 'h3',
  analyticsId,
}: EmptyStateProps) {
  const Heading = headingLevel

  return (
    <Card className={className}>
      {analyticsId ? (
        <TrackEventOnMount eventName="empty_state_shown" payload={{ control: analyticsId }} />
      ) : null}
      <div className="flex flex-col items-center text-center">
        <Heading className="text-section-title text-content-primary">{title}</Heading>
        {description ? <p className="text-body mt-2 max-w-[60ch]">{description}</p> : null}
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </Card>
  )
}
