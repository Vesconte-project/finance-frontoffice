import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'

type DashboardLayoutProps = {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="container-md section-gap">
      <div className="sticky top-[5.8rem] z-20 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 dark:border-[var(--line)] dark:bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          Today
        </Link>
        <Link href="/dashboard/watchlist" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          Watchlist
        </Link>
        <Link href="/dashboard/research" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          Research
        </Link>
        <Link href="/dashboard/alerts" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
          Alerts
        </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
