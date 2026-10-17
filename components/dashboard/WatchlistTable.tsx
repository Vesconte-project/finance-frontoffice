import Link from 'next/link'
import OrbitMini from '@/components/stocks/OrbitMini'
import { TableBase, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TableShell } from '@/components/ui/DataTable'
import type { WatchlistWorkspaceRow } from '@/lib/watchlist-workspace'

export default function WatchlistTable({ rows }: { rows: WatchlistWorkspaceRow[] }) {
  return <TableShell><TableBase><TableHead><tr>
    <TableHeaderCell>Ticker</TableHeaderCell><TableHeaderCell>Company scorecard</TableHeaderCell>
  </tr></TableHead><TableBody>{rows.map(({ ticker, scorecard }, index) =>
    <TableRow key={ticker} index={index}>
      <TableCell><Link href={`/stocks/${encodeURIComponent(ticker)}`} className="text-accent-text hover:underline">{ticker}</Link></TableCell>
      <TableCell>{scorecard ? <OrbitMini scorecard={scorecard} size={80} /> : <span className="text-content-muted">Unavailable</span>}</TableCell>
    </TableRow>)}</TableBody></TableBase></TableShell>
}
