import { notFound } from 'next/navigation'
import { getViewerUserId } from '@/lib/auth'
import { syntheticResearchEnabled } from '@/lib/synthetic-research-access'
import SyntheticComparison from '@/components/research/SyntheticComparison'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
export const dynamic = 'force-dynamic'
export default async function SyntheticComparisonPage() {
  if (!syntheticResearchEnabled()) notFound()
  if (!(await getViewerUserId()))
    return (
      <section className="py-8">
        <h1 className="text-page-title">Sign in to compare synthetic variants</h1>
        <Link
          className={buttonClass()}
          href="/sign-in?redirect_url=%2Fdashboard%2Fresearch%2Fsynthetic"
        >
          Sign in
        </Link>
      </section>
    )
  return <SyntheticComparison />
}
