/**
 * What a reading needs before it is given, in words a reader can follow.
 *
 * Implements Spec "Reading eligibility V1" (accepted Snapshot
 * snap-sha256-ce95a67c388122e9de7237616d310b4689eb9add1e2c168ba0adc45e689b9401), §4.4.
 * The rule itself lives in the feature store and reaches this file through the
 * backend payload. Nothing here decides who is eligible; it only says it.
 */

export type ReadingPart = {
  key: string
  label: string
  required: boolean
}

export type EligibilityRule = {
  required: { key: string; label: string }
  anyOf: { key: string; label: string }[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function readLabelledKey(value: unknown): { key: string; label: string } | null {
  const record = asRecord(value)
  if (!record || typeof record.key !== 'string' || !record.key) return null
  const label = typeof record.label === 'string' && record.label ? record.label : record.key
  return { key: record.key, label }
}

/**
 * The parts on an absent reading. Absent or malformed parts read as `null`: the
 * row then shows its value without the detail line rather than disappearing,
 * because the parts are an addition to a payload the page already trusts.
 */
export function parseReadingParts(value: unknown): ReadingPart[] | null {
  if (!Array.isArray(value)) return null
  const parts: ReadingPart[] = []
  for (const entry of value) {
    const labelled = readLabelledKey(entry)
    const record = asRecord(entry)
    if (!labelled || !record || typeof record.required !== 'boolean') return null
    parts.push({ ...labelled, required: record.required })
  }
  return parts
}

export function parseEligibilityRule(value: unknown): EligibilityRule | null {
  const record = asRecord(value)
  if (!record) return null
  const required = readLabelledKey(record.required)
  if (!required || !Array.isArray(record.anyOf)) return null
  const anyOf = record.anyOf.map(readLabelledKey)
  if (anyOf.length === 0 || anyOf.some((part) => part === null)) return null
  return { required, anyOf: anyOf as { key: string; label: string }[] }
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

function joinOr(labels: string[]): string {
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

/** "A company is ranked only when its financial health and at least one of … were measured." */
export function eligibilitySentence(rule: EligibilityRule): string {
  const others = joinOr(rule.anyOf.map((part) => lowerFirst(part.label)))
  const oneOf = rule.anyOf.length > 1 ? `at least one of ${others}` : others
  return `A company is ranked only when its ${lowerFirst(rule.required.label)} and ${oneOf} were measured.`
}

/** "Measured: Price versus peers, Growth · Missing: Financial health (required)" */
export function readingPartsDetail(measured: ReadingPart[] | null, missing: ReadingPart[] | null): string | null {
  const sections: string[] = []
  if (measured && measured.length > 0) {
    sections.push(`Measured: ${measured.map((part) => part.label).join(', ')}`)
  }
  if (missing && missing.length > 0) {
    sections.push(`Missing: ${missing.map((part) => (part.required ? `${part.label} (required)` : part.label)).join(', ')}`)
  }
  return sections.length > 0 ? sections.join(' · ') : null
}
