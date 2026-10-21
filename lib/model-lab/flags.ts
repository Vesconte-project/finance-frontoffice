type Env = Readonly<Record<string, string | undefined>>

/**
 * The thesis composer is a preview of a design that has no backend behind it yet.
 * It is off unless `MODEL_LAB_COMPOSER_ENABLED=true`, and it never opens on Vercel
 * Production, whatever the variable says.
 */
export function modelLabComposerEnabled(env: Env = process.env): boolean {
  return env.MODEL_LAB_COMPOSER_ENABLED === 'true' && env.VERCEL_ENV !== 'production'
}
