/** The current time, behind a function so a page does not read the clock while it renders. */
export function currentTimeMs(): number {
  return Date.now()
}
