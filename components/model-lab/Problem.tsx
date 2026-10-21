import Link from 'next/link'
import Card from '@/components/ui/Card'
import RetryButton from '@/components/ui/RetryButton'
import { buttonClass } from '@/components/ui/Button'
import { MODEL_LAB_ERROR_MESSAGES, type ModelLabError } from '@/lib/model-lab/contract'

const TITLES: Readonly<Record<ModelLabError['code'], string>> = {
  unauthenticated: 'Sign in to use the Model Lab',
  forbidden: 'Not available on your account',
  'not-found': 'We could not find that',
  conflict: 'That changed',
  invalid: 'Something in the request was not right',
  quota: 'You have reached your limit',
  'rate-limited': 'Too many requests',
  unavailable: 'The Model Lab is not open yet',
  upstream: 'Something went wrong',
}

/** The one place a failed read becomes something a person can act on. */
export default function Problem({ error, back }: { error: ModelLabError; back?: { href: string; label: string } }) {
  const retry = error.code === 'upstream' || error.code === 'rate-limited' || error.code === 'conflict' || error.code === 'unavailable'
  return (
    <Card role="alert" padding="lg" className="mt-6">
      <h2 className="text-section-title text-content-primary">{TITLES[error.code]}</h2>
      <p className="text-body mt-2 max-w-[60ch]">{MODEL_LAB_ERROR_MESSAGES[error.code]}</p>
      {error.retryAfter ? <p className="text-body-sm mt-1 text-content-muted">Try again in {error.retryAfter} seconds.</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {error.code === 'unauthenticated' ? (
          <Link href="/sign-in?redirect_url=%2Fmodels" className={buttonClass()}>Sign in</Link>
        ) : null}
        {retry ? <RetryButton variant="secondary">Try again</RetryButton> : null}
        {back ? <Link href={back.href} className={buttonClass({ variant: 'secondary' })}>{back.label}</Link> : null}
      </div>
    </Card>
  )
}
