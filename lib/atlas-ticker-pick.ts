/**
 * On the atlas the site search picks a company on the map instead of opening
 * its page: the header announces the pick and the atlas answers it.
 */
export const ATLAS_ROUTE = '/markets/network'
export const ATLAS_PICK_TICKER = 'vesconte:atlas-pick-ticker'

export function announceAtlasPick(symbol: string) {
  window.dispatchEvent(new CustomEvent<string>(ATLAS_PICK_TICKER, { detail: symbol }))
}
