'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import Button from '@/components/ui/Button'
import Dialog from '@/components/ui/Dialog'
import styles from './StockDataExportButton.module.css'

export default function StockDataExportButton({ ticker, signedIn }: { ticker: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  const [dataset, setDataset] = useState('prices')
  const [statement, setStatement] = useState('income_statement')
  const [period, setPeriod] = useState('annual')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [recovery, setRecovery] = useState<'sign-in' | 'upgrade' | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const controller = useRef<AbortController | null>(null)
  const downloads = useRef(new Set<string>())
  const id = useId()
  useEffect(() => () => {
    controller.current?.abort()
    for (const url of downloads.current) URL.revokeObjectURL(url)
  }, [])
  const close = () => {
    controller.current?.abort()
    setPending(false)
    setOpen(false)
  }
  const clear = () => { setMessage(''); setRecovery(null) }
  const download = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (controller.current && !controller.current.signal.aborted && pending) return
    const attempt = new AbortController()
    controller.current = attempt
    setPending(true)
    clear()
    const query = new URLSearchParams({ dataset })
    if (dataset === 'fundamentals') { query.set('statement', statement); query.set('period', period) }
    try {
      const response = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/export?${query}`, {
        cache: 'no-store', signal: AbortSignal.any([attempt.signal, AbortSignal.timeout(25000)]),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        if (response.status === 401) setRecovery('sign-in')
        if (response.status === 403 && payload?.upgradeUrl === '/pricing') setRecovery('upgrade')
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'The export could not be prepared. Try again.')
      }
      if (!response.headers.get('content-type')?.startsWith('text/csv')) throw new Error('The export could not be verified. Try again.')
      const blob = await response.blob()
      if (attempt.signal.aborted) return
      if (!blob.size) throw new Error('No data is available for this export.')
      const filename = response.headers.get('content-disposition')?.match(/filename="([A-Za-z0-9._-]+\.csv)"/)?.[1]
      if (!filename) throw new Error('The export could not be verified. Try again.')
      const url = URL.createObjectURL(blob)
      downloads.current.add(url)
      const link = document.createElement('a')
      link.href = url; link.download = filename
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => { URL.revokeObjectURL(url); downloads.current.delete(url) }, 60000)
      setMessage('Your CSV is ready. Check your downloads.')
    } catch (error) {
      if (!attempt.signal.aborted) setMessage(error instanceof Error ? error.message : 'The export could not be prepared. Try again.')
    } finally { if (!attempt.signal.aborted) setPending(false) }
  }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Export ${ticker} data as CSV`}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => { clear(); setOpen(true) }}>
      <Download size={16} strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only">Export CSV</span>
    </button>
    <Dialog open={open} onClose={close} labelledBy={`${id}-title`} describedBy={`${id}-description`} returnFocusRef={trigger} className={styles.dialog}>
      <div className={styles.panel}>
        <h2 id={`${id}-title`}>Export {ticker}</h2>
        <p id={`${id}-description`}>Download the data behind your research as CSV. Available with Pro.</p>
        {!signedIn ? <p><Link prefetch={false} href={`/sign-in?redirect_url=${encodeURIComponent(`/stocks/${ticker}`)}`}>Sign in</Link> to export data, or <Link prefetch={false} href="/pricing">explore Pro</Link>.</p> :
          <form onSubmit={download} className={styles.form}>
            <label htmlFor={`${id}-data`}>Data</label>
            <select id={`${id}-data`} value={dataset} disabled={pending} onChange={event => { setDataset(event.target.value); clear() }}>
              <option value="prices">Daily adjusted prices · last year</option>
              <option value="fundamentals">Financial statements</option>
            </select>
            {dataset === 'fundamentals' ? <>
              <label htmlFor={`${id}-statement`}>Statement</label>
              <select id={`${id}-statement`} value={statement} disabled={pending} onChange={event => { setStatement(event.target.value); clear() }}>
                <option value="income_statement">Income statement</option><option value="balance_sheet">Balance sheet</option><option value="cash_flow">Cash flow</option>
              </select>
              <label htmlFor={`${id}-period`}>Periods</label>
              <select id={`${id}-period`} value={period} disabled={pending} onChange={event => { setPeriod(event.target.value); clear() }}>
                <option value="annual">Annual</option><option value="quarterly">Quarterly</option>
              </select>
            </> : null}
            <p className={styles.note}>{dataset === 'prices'
              ? 'Daily prices adjusted for splits and dividends, in the listing’s original quote units. The display currency does not change this file.'
              : 'The latest revision of each available line item and period, in its reported currency. Includes source, observation dates and quality flags. Up to 500 rows; larger results are refused rather than cut short.'}</p>
            <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? 'Preparing CSV…' : 'Download CSV'}</Button>
            <p role="status" aria-live="polite" className={styles.status}>{pending ? 'Preparing your file…' : message}</p>
            {recovery === 'sign-in' ? <Link prefetch={false} href={`/sign-in?redirect_url=${encodeURIComponent(`/stocks/${ticker}`)}`}>Sign in again</Link> : null}
            {recovery === 'upgrade' ? <Link prefetch={false} href="/pricing">Explore Pro</Link> : null}
          </form>}
      </div>
    </Dialog>
  </>
}
