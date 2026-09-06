'use client'

import TickerSearchCombobox from '@/components/search/TickerSearchCombobox'

export default function HeaderSearch({
  className,
  maxSuggestions,
  placeholder = 'Search tracked tickers or company names...',
  typingHints,
}: {
  className?: string
  maxSuggestions?: number
  placeholder?: string
  typingHints?: readonly string[]
}) {
  return (
    <TickerSearchCombobox
      className={className}
      maxSuggestions={maxSuggestions}
      placeholder={placeholder}
      typingHints={typingHints}
      routeForTicker={(symbol) => `/stocks/${encodeURIComponent(symbol)}`}
      variant="header"
    />
  )
}
