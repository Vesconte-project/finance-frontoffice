/** Only curated, reader-facing source names may appear beside a description. */
export function descriptionSourceLabel(source: string | null | undefined): string | null {
  switch (source) {
    case 'yahoo_finance': return 'Yahoo Finance'
    case 'feature_store.entity_attributes_static': return 'Vesconte company profile'
    default: return null
  }
}
