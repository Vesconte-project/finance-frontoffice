import assert from 'node:assert/strict'
import test from 'node:test'
import { modelLabComposerEnabled } from '../lib/model-lab/flags'

test('the composer is off unless it is explicitly enabled', () => {
  assert.equal(modelLabComposerEnabled({}), false)
  assert.equal(modelLabComposerEnabled({ MODEL_LAB_COMPOSER_ENABLED: 'false' }), false)
  assert.equal(modelLabComposerEnabled({ MODEL_LAB_COMPOSER_ENABLED: '1' }), false)
})

test('the composer opens when enabled outside Production', () => {
  assert.equal(modelLabComposerEnabled({ MODEL_LAB_COMPOSER_ENABLED: 'true' }), true)
  assert.equal(modelLabComposerEnabled({ MODEL_LAB_COMPOSER_ENABLED: 'true', VERCEL_ENV: 'preview' }), true)
})

test('the composer never opens on Vercel Production', () => {
  assert.equal(modelLabComposerEnabled({ MODEL_LAB_COMPOSER_ENABLED: 'true', VERCEL_ENV: 'production' }), false)
})
