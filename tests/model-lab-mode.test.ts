import assert from 'node:assert/strict'
import test from 'node:test'
import { ModelLabError } from '../lib/model-lab/contract'
import { modelLabMode, notOpenYet } from '../lib/model-lab/mode'

test('the Model Lab reads the platform API unless fixtures are enabled', () => {
  assert.equal(modelLabMode({}), 'backend')
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: '1' }), 'backend')
  assert.equal(modelLabMode({ VERCEL_ENV: 'production' }), 'backend')
})

test('fixtures open outside Production only', () => {
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true' }), 'fixtures')
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true', VERCEL_ENV: 'preview' }), 'fixtures')
  assert.equal(modelLabMode({ MODEL_LAB_FIXTURES: 'true', VERCEL_ENV: 'production' }), 'backend')
})

test('a platform without the Model Lab routes means it is not open yet', () => {
  assert.equal(notOpenYet(new ModelLabError('not-found')).code, 'unavailable')
  for (const code of ['unauthenticated', 'forbidden', 'upstream', 'unavailable'] as const)
    assert.equal(notOpenYet(new ModelLabError(code)).code, code)
})
