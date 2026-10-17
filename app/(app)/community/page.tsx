import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'

export default function CommunityPage() {
  return (
    <div className="container-lg section-gap">
      <PageHeader title="Community" />
      <EmptyState
        title="Community is temporarily unavailable"
        description="The community view is currently unavailable."
      />
    </div>
  )
}
