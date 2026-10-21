/** Writes a long-lived cookie from the browser. Used for view preferences only. */
export function setPreferenceCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`
}
