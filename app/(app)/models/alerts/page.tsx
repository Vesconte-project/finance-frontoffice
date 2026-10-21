import AlertsInbox from '@/components/model-lab/AlertsInbox'
import Problem from '@/components/model-lab/Problem'
import { PageTitle } from '@/components/model-lab/ui'
import { labContext, load } from '@/lib/model-lab/context'
import { currentTimeMs } from '@/lib/model-lab/time'

export const dynamic = 'force-dynamic'

export default async function AlertsPage() {
  const { source } = await labContext()
  const alerts = await load(() => source.listAlerts())
  if (!alerts.ok) return <Problem error={alerts.error} />
  return (
    <div className="space-y-6">
      <PageTitle title="Alerts">What changed in the theses and panels you follow, and why. Alerts describe the evidence. They do not predict anything.</PageTitle>
      <AlertsInbox alerts={alerts.data} todayIso={new Date(currentTimeMs()).toISOString().slice(0, 10)} />
    </div>
  )
}
