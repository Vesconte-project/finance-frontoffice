'use client'

import { usePathname } from 'next/navigation'
import TickerSearchCombobox from '@/components/search/TickerSearchCombobox'
import { ATLAS_ROUTE, announceAtlasPick } from '@/lib/atlas-ticker-pick'

export default function HeaderSearch({
  className,
  maxSuggestions,
  placeholder = 'Search tickers or companies',
  typingHints,
}: {
  className?: string
  maxSuggestions?: number
  placeholder?: string
  typingHints?: readonly string[]
}) {
  // On the atlas a ticker is selected on the map rather than opened.
  const onAtlas = usePathname() === ATLAS_ROUTE
  return (
    <TickerSearchCombobox
      className={className}
      maxSuggestions={maxSuggestions}
      placeholder={placeholder}
      typingHints={typingHints}
      routeForTicker={(symbol) => `/stocks/${encodeURIComponent(symbol)}`}
      onPickTicker={onAtlas ? announceAtlasPick : undefined}
      variant="header"
    />
  )
}
