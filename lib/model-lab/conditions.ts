/** The market conditions a model's record is broken down by. */
export const CONDITION_LABELS: Readonly<Record<string, string>> = {
  calm: 'Calm',
  trend: 'Trending up',
  highvol: 'High volatility',
  falling: 'Falling market',
  choppy: 'Choppy',
}

export function conditionLabel(key: string): string {
  return CONDITION_LABELS[key] ?? key
}

/** A hit rate at or above this on days like the condition counts as a record worth noting. */
export const SKILL_THRESHOLD = 0.55

export const RULE_TEXT = {
  agree: (needed: number, of: number) => `Flag a stock when ${needed} of ${of} models agree`,
  spec: () => 'Listen to the models that have a good record in today’s conditions',
  blend: () => 'Blend every model’s score into one',
} as const
