import Link from 'next/link'
import Card from '@/components/ui/Card'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import WatchlistTable from '@/components/dashboard/WatchlistTable'
import { getViewerUserId } from '@/lib/auth'
import { getWatchlistWorkspace } from '@/lib/watchlist-workspace'

export const dynamic = 'force-dynamic'
export default async function WorkspacePage() {
  if (!(await getViewerUserId())) return <EmptyState title="Sign in to open your watchlist"
    description="Your saved tickers and research are private."
    action={<Link href="/sign-in" className={buttonClass()}>Sign in</Link>} />
  let workspace: Awaited<ReturnType<typeof getWatchlistWorkspace>>
  try { workspace = await getWatchlistWorkspace() }
  catch { return <EmptyState title="Watchlist is temporarily unavailable"
    description="Your saved watchlist could not be loaded." action={<RetryButton>Retry</RetryButton>} /> }
  return <div className="section-gap">
    <PageHeader title="Watchlist" subtitle="Your saved tickers and company research." />
    <p className="text-body text-content-muted">Directional signals, signal alerts and CSV exports are unavailable.</p>
    {workspace.tickers.length ? <WatchlistTable rows={workspace.watchlistRows} /> :
      <Card><h2 className="text-section-title">Your watchlist is empty</h2>
        <p className="text-body mt-2">Open a ticker page and choose Add to Watchlist.</p>
        <Link prefetch={false} href="/stocks/SPY" className={buttonClass({ variant: 'secondary' })}>Open SPY</Link></Card>}
  </div>
}
