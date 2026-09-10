import type { Metadata } from 'next'
import ProductPage from '@/components/marketing/ProductPage'

export const metadata: Metadata = {
  title: 'Product | Vesconte',
  description: 'Explore Vesconte signals, ticker research, scorecards, comparisons, watchlists, and AI analysis.',
}

export default function Product() {
  return <ProductPage />
}
