import assert from 'node:assert/strict'
import test from 'node:test'

import { createWebVitalsReporter } from '../lib/web-vitals-report'

test('each metric instance is sent once, with the path at send time', () => {
  const sent: Array<Record<string, unknown>> = []
  let path = '/'
  const report = createWebVitalsReporter((_event, properties) => sent.push(properties), () => path)
  path = '/stocks/PFE'
  const cls = { id: 'v4-1', name: 'CLS', value: 0.00412, rating: 'good' }
  // The same metric delivered twice, as stacked listeners did.
  report(cls)
  report(cls)
  report({ id: 'v4-2', name: 'INP', value: 63.6, rating: 'good' })
  assert.deepEqual(sent, [
    { metric: 'CLS', value: 0.004, rating: 'good', path: '/stocks/PFE' },
    { metric: 'INP', value: 64, rating: 'good', path: '/stocks/PFE' },
  ])
})

test('the id memory stays bounded', () => {
  const sent: unknown[] = []
  const report = createWebVitalsReporter(() => sent.push(1), () => '/', 2)
  for (const id of ['a', 'b', 'c', 'a']) report({ id, name: 'LCP', value: 1 })
  assert.equal(sent.length, 4)
})
