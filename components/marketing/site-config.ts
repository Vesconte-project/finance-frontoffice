export const BRAND_NAME = 'Vesconte'

export const BRAND_DESCRIPTION =
  'Market signals, company research, watchlists, and AI context in one workspace.'

// Where "ask us anything" messages are sent. Change this to your real inbox.
export const CONTACT_EMAIL = 'support@vesconte.com'

export const MARKETING_NAV_ITEMS = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
] as const

export const FOOTER_LINKS = [
  ...MARKETING_NAV_ITEMS,
  { label: 'Disclosures', href: '/product#limits' },
  { label: 'Contact', href: '/faq#contact' },
] as const
