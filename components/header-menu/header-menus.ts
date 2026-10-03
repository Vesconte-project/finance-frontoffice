export type HeaderMenuTileData = {
  label: string
  href: string
}

export type HeaderMenuData = {
  key: string
  label: string
  href: string
  blurb: string
  tiles: HeaderMenuTileData[]
  /* The account menu swaps the text tile's single View link for the two account
     actions, which are Clerk calls rather than routes. */
  kind?: 'account'
}

export const HEADER_MENUS: HeaderMenuData[] = [
  {
    key: 'today',
    label: 'Today',
    href: '/dashboard',
    blurb: 'The market changes every day. The kind of investor you are does not. Start there.',
    // The three readings are one measurement seen from three horizons, not three
    // weightings of one score — short term barely touches the axes the other two
    // live on.
    tiles: [
      { label: 'Long term', href: '/picks/long-term' },
      { label: 'Income', href: '/picks/income' },
      { label: 'Short term', href: '/picks/short-term' },
      { label: 'Calendar', href: '/calendar' },
    ],
  },
  {
    key: 'correlation',
    label: 'Correlation',
    href: '/markets/network',
    blurb: 'How names move together — the network, the pairs that track each other, and where a sector ends.',
    tiles: [
      { label: 'Network', href: '/markets/network' },
      { label: 'Pairs', href: '/markets' },
      { label: 'Sectors', href: '/markets' },
      { label: 'Signals', href: '/screener' },
    ],
  },
]

export const ACCOUNT_MENU_TILES: HeaderMenuTileData[] = [
  { label: 'Watchlist', href: '/dashboard/watchlist' },
  { label: 'Alerts', href: '/dashboard/alerts' },
  { label: 'Model Lab', href: '/models' },
  { label: 'Community', href: '/community' },
]

export function accountMenu(blurb: string): HeaderMenuData {
  return {
    key: 'account',
    label: 'Account',
    href: '/dashboard',
    blurb,
    tiles: ACCOUNT_MENU_TILES,
    kind: 'account',
  }
}
