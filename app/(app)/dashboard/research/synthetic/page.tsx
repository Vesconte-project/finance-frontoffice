import { notFound } from 'next/navigation'
import { getViewerUserId } from '@/lib/auth'
import NativeComparison from '@/components/research/NativeComparison'
import { platformEnabled } from '@/lib/platform-server'
import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
export const dynamic = 'force-dynamic'
export default async function SyntheticComparisonPage() {
  if (!platformEnabled()) notFound()
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
  return <NativeComparison />
}
