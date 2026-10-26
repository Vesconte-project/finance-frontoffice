'use client'
import TickerSearchCombobox from '@/components/search/TickerSearchCombobox'
export default function Search() {
  return <TickerSearchCombobox placeholder="Search ticker" routeForTicker={symbol => `/stocks/${encodeURIComponent(symbol)}`} />
}
