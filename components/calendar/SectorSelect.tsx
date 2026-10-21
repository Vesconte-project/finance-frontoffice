'use client'

/**
 * The region choice: companies grouped by their region on the weekly atlas. A
 * plain GET form: choosing a region loads it at once, and without script the
 * button beside the list does the same.
 */
export default function SectorSelect({ action, hidden, sectors, value, className, buttonClassName }: {
  action: string
  hidden: Record<string, string>
  sectors: Array<{ sector: string; count: number }>
  value: string | null
  className?: string
  buttonClassName?: string
}) {
  return (
    <form className={className} action={action} method="get" aria-label="Atlas region">
      {Object.entries(hidden).map(([name, current]) => <input key={name} type="hidden" name={name} value={current} />)}
      <label htmlFor="calendar-sector">Region</label>
      <select id="calendar-sector" name="sector" defaultValue={value ?? ''} onChange={(event) => event.currentTarget.form?.requestSubmit()} data-analytics-id="calendar_focus_sector">
        <option value="">All regions</option>
        {value && !sectors.some((item) => item.sector === value) ? <option value={value}>{value} (0)</option> : null}
        {sectors.map((item) => <option key={item.sector} value={item.sector}>{item.sector} ({item.count})</option>)}
      </select>
      <noscript><button type="submit" className={buttonClassName}>Show</button></noscript>
    </form>
  )
}
