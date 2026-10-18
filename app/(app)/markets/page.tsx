import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { buttonClass } from '@/components/ui/Button'

export default function DirectionalSignalsUnavailablePage() {
  return <EmptyState title="Markets" description="Directional signals are currently unavailable. Price history and company research remain available."
    action={<Link href="/calendar" className={buttonClass({ variant: 'secondary' })}>Open market calendar</Link>} />
}
