import assert from 'node:assert/strict'
import test from 'node:test'
import { modelLabMode } from '../lib/model-lab/mode'

test('the Model Lab is off unless a mode is explicitly enabled', () => {
  assert.equal(modelLabMode({}), 'off')
  assert.equal(modelLabMode({ MODEL_LAB_ENABLED: 'false', MODEL_LAB_FIXTURES: '1' }), 'off')
})

test('the backend mode needs MODEL_LAB_ENABLED=true', () => {
  assert.equal(modelLabMode({ MODEL_LAB_ENABLED: 'true' }), 'backend')
  assert.equal(modelLabMode({ MODEL_LAB_ENABLED: 'true', VERCEL_ENV: 'production' }), 'backend')
})

test('fixtures open outside Production and win over the backend mode', () => {
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true' }), 'fixtures')
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true', MODEL_LAB_ENABLED: 'true', VERCEL_ENV: 'preview' }), 'fixtures')
})

test('fixtures never open on Vercel Production', () => {
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true', VERCEL_ENV: 'production' }), 'off')
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true', MODEL_LAB_ENABLED: 'true', VERCEL_ENV: 'production' }), 'backend')
})
