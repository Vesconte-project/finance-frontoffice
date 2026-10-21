import Link from 'next/link'
import AlertsFeed from '@/components/model-lab/AlertsFeed'
import FirstUse from '@/components/model-lab/FirstUse'
import Problem from '@/components/model-lab/Problem'
import ThesisList from '@/components/model-lab/ThesisList'
import { PageTitle } from '@/components/model-lab/ui'
import { buttonClass } from '@/components/ui/Button'
import { labContext, load } from '@/lib/model-lab/context'
import { currentTimeMs } from '@/lib/model-lab/time'

export const metadata = { title: 'Model Lab' }
export const dynamic = 'force-dynamic'

export default async function ModelsHomePage() {
  const { source, viewer } = await labContext()
  const [theses, alerts] = await Promise.all([load(() => source.listTheses()), load(() => source.listAlerts())])
  if (!theses.ok) return <Problem error={theses.error} />

  if (theses.data.length === 0) {
    return (
      <>
        <PageTitle title="Test an idea before you trust it" actions={<Link href="/models/new" className={buttonClass()}>Test your first thesis</Link>}>
          Write down what you believe about a few stocks, check it against the past with costs included, and keep watching whether it still holds.
        </PageTitle>
        <FirstUse allowance={viewer.plan === 'free' ? null : `Your first tests are included in your allowance of ${viewer.quota.limit} ${viewer.quota.unit.many} a period.`} />
      </>
    )
  }

  return (
    <>
      <PageTitle
        title="Your theses"
        actions={
          <>
            <Link href="/models/compare" className={buttonClass({ variant: 'secondary' })}>Compare theses</Link>
            <Link href="/models/new" className={buttonClass()}>Test a new thesis</Link>
          </>
        }
      >
        Write down what you believe about a few stocks, test it on the past, and keep watching whether the evidence still holds.
      </PageTitle>
      {alerts.ok ? <AlertsFeed alerts={alerts.data} /> : null}
      <ThesisList theses={theses.data} nowMs={currentTimeMs()} />
      <p className="text-caption text-content-muted">This shows what happened in past data. It is not a forecast and it is not investment advice.</p>
    </>
  )
}
