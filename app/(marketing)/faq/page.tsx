import type { Metadata } from 'next'
import FaqPage from '@/components/marketing/FaqPage'

export const metadata: Metadata = {
  title: 'FAQ | Vesconte',
  description: 'Clear answers about Vesconte signals, market data, features, accounts, and plans.',
}

export default function Faq() {
  return <FaqPage />
}
