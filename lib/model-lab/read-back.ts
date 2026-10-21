import type { CheckKey, EvidenceCheck, EvidenceChange } from './contract'

const SHORT: Readonly<Record<CheckKey, string>> = {
  costs: 'costs',
  periods: 'different periods',
  robust: 'small changes',
  recent: 'recent months',
  baseline: 'the simple rule',
}

function list(names: readonly string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
}

/** The checks said in a sentence: which hold and which do not, with no verdict on top. */
export function describeChecks(checks: readonly EvidenceCheck[]): string {
  const good = checks.filter((c) => c.state === 'holds').map((c) => SHORT[c.key])
  const rest = checks.filter((c) => c.state !== 'holds').map((c) => SHORT[c.key])
  if (checks.length > 0 && rest.length === 0) return `All ${checks.length} checks hold.`
  if (good.length === 0) return 'None of the checks hold.'
  return `It holds up on ${list(good)}. It is shakier on ${list(rest)}.`
}

export type ChangeReading = Readonly<{ headline: string; detail: string }>

/** What moved since the last test, as facts about the checks. */
export function describeChange(change: EvidenceChange, checks: readonly EvidenceCheck[], asOfLabel: string): ChangeReading {
  const { previousHolding: before, currentHolding: now } = change
  if (before === now) return { headline: 'Nothing moved since the last test.', detail: `The same checks hold, on data up to ${asOfLabel}.` }
  const moved = checks.find((c) => c.key === change.movedCheck)
  return {
    headline: `${before} of ${checks.length} checks held last time, ${now} hold now.`,
    detail: moved ? `The check that moved is “${moved.title}”. It depends on ${SHORT[moved.key]}, which changed as new days were added.` : `Data now runs to ${asOfLabel}.`,
  }
}
