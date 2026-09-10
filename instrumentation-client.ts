/**
 * Client instrumentation. Runs after the document loads and before React
 * hydration, so the delegated capture is listening before the user can click
 * anything, and on every route including ones that render no client component.
 *
 * Keep this file cheap. Next.js warns in development when client
 * instrumentation takes longer than 16ms to initialise.
 */

import { installGlobalTelemetry, recordNavigationType } from '@/lib/analytics'

try {
  installGlobalTelemetry()
} catch {
  // A failure to install telemetry must not stop the app from booting.
}

/**
 * Fires as a navigation begins. This records how the navigation started and
 * emits nothing of its own: the committed `page_view` picks the value up, so a
 * link click is not counted once here and again by the delegated capture.
 * Without this, a back button and a link click would look identical.
 */
export function onRouterTransitionStart(
  _url: string,
  navigationType: 'push' | 'replace' | 'traverse'
) {
  try {
    recordNavigationType(navigationType)
  } catch {
    // Ignore.
  }
}
