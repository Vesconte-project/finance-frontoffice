/** The subset of a Next.js web-vitals metric that the reporter reads. */
export type ReportedMetric = { id: string; name: string; value: number; rating?: string }

type Track = (event: 'web_vitals', properties: Record<string, string | number | null>) => void

/**
 * One web_vitals event per metric instance, attributed to the page where it is sent.
 *
 * `useReportWebVitals` registers its callback again whenever the callback's identity
 * changes. An inline callback therefore stacked one listener per render, each sending
 * the same metric and each remembering the path it was created on. The reporter must
 * be created once, outside React, and it ignores a metric id it has already sent.
 */
export function createWebVitalsReporter(track: Track, currentPath: () => string, capacity = 200) {
  const sent = new Set<string>()
  return function report(metric: ReportedMetric): void {
    if (sent.has(metric.id)) return
    if (sent.size >= capacity) sent.clear()
    sent.add(metric.id)
    // CLS is unitless; every other metric is milliseconds. Rounding keeps the
    // log line small without losing anything actionable.
    const value = metric.name === 'CLS' ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value)
    track('web_vitals', {
      metric: metric.name,
      value,
      rating: metric.rating ? String(metric.rating) : null,
      path: currentPath(),
    })
  }
}
