/**
 * Plain names for regulatory filing types, so a reader sees "Quarterly report"
 * rather than "10-Q", and the file name a source sometimes uses as a title
 * ("xsl144X01/primary_doc.xml") is never shown as one. The form code stays
 * visible beside the name for readers who know it.
 */
export type FilingGroup = 'results' | 'insiders' | 'holders' | 'meetings' | 'other'

export const FILING_GROUP_LABEL: Record<FilingGroup, string> = {
  results: 'Reports',
  insiders: 'Insider trades',
  holders: 'Large holders',
  meetings: 'Shareholder meetings',
  other: 'Other filings',
}

type Known = { label: string; group: FilingGroup }

const KNOWN: Record<string, Known> = {
  '10-K': { label: 'Annual report', group: 'results' },
  '10-Q': { label: 'Quarterly report', group: 'results' },
  '8-K': { label: 'Current report', group: 'results' },
  '20-F': { label: 'Annual report', group: 'results' },
  '40-F': { label: 'Annual report', group: 'results' },
  '6-K': { label: 'Current report', group: 'results' },
  'ARS': { label: 'Annual report to shareholders', group: 'results' },
  '3': { label: 'Initial insider holding', group: 'insiders' },
  '4': { label: 'Insider trade', group: 'insiders' },
  '5': { label: 'Annual insider statement', group: 'insiders' },
  '144': { label: 'Planned insider sale', group: 'insiders' },
  'SCHEDULE 13G': { label: 'Large holder over 5%', group: 'holders' },
  'SC 13G': { label: 'Large holder over 5%', group: 'holders' },
  'SCHEDULE 13D': { label: 'Active large holder over 5%', group: 'holders' },
  'SC 13D': { label: 'Active large holder over 5%', group: 'holders' },
  '13F-HR': { label: 'Fund holdings report', group: 'holders' },
  'DEF 14A': { label: 'Proxy statement', group: 'meetings' },
  'DEFA14A': { label: 'Additional proxy material', group: 'meetings' },
  'PX14A6G': { label: 'Shareholder campaign notice', group: 'meetings' },
  'PRE 14A': { label: 'Preliminary proxy statement', group: 'meetings' },
  'SD': { label: 'Specialized disclosure', group: 'other' },
  'S-8': { label: 'Employee share plan registration', group: 'other' },
  'S-3': { label: 'Securities registration', group: 'other' },
  'S-1': { label: 'Securities registration', group: 'other' },
}

/** The form code as the source writes it, tidied: "SCHEDULE_13G" → "SCHEDULE 13G", "FORM 4" → "4". */
export function filingCode(documentType: string | null | undefined): string | null {
  const code = (documentType ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase()
  if (!code) return null
  return code.replace(/^FORM\s+/, '')
}

export function describeFiling(documentType: string | null | undefined, title: string | null | undefined): {
  label: string
  group: FilingGroup
  code: string | null
  /** The filing's own title when it says something the label does not (a filer's name, say). */
  detail: string | null
} {
  const code = filingCode(documentType)
  const amended = Boolean(code && /\/A$/.test(code))
  const base = code ? code.replace(/\/A$/, '') : null
  const known = base ? KNOWN[base] : undefined
  const label = known ? `${known.label}${amended ? ' (amended)' : ''}` : code ?? 'Filing'
  const text = (title ?? '').trim()
  const fileName = /[/\\]|\.(xml|html?|txt|pdf)$/i.test(text)
  let detail = !text || fileName || filingCode(text) === code ? null : text
  // "NATIONAL LEGAL AND POLICY CENTER - PX14A6G": keep the filer, drop the repeated code.
  if (detail && code && detail.toUpperCase().endsWith(` - ${code}`)) detail = detail.slice(0, -(code.length + 3)).trim()
  return { label, group: known?.group ?? 'other', code, detail: detail || null }
}
