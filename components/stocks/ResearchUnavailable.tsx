import EmptyState from '@/components/ui/EmptyState'
import RetryButton from '@/components/ui/RetryButton'
import TrackEventOnMount from '@/components/analytics/TrackEventOnMount'

export default function ResearchUnavailable({ ticker }: { ticker: string }) {
  return (
    <div>
      <TrackEventOnMount
        eventName="unavailable_shown"
        payload={{ surface: 'ticker_research', ticker: ticker.toUpperCase() }}
      />
      <EmptyState
        headingLevel="h1"
        title="Research data is temporarily unavailable"
        description={`Vesconte could not load the current research data for ${ticker}.`}
        action={<RetryButton analyticsId="research_unavailable_retry">Retry</RetryButton>}
      />
    </div>
  )
}
