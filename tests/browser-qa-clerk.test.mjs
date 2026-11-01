import assert from 'node:assert/strict'
import test from 'node:test'
import { clerkQaConfigurationError } from '../scripts/browser-qa-clerk.mjs'

test('missing or incomplete local QA configuration cannot trigger keyless provisioning', () => {
  for (const env of [{}, { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture' }])
    assert.match(clerkQaConfigurationError(env), /keyless provisioning is disabled/)
})

test('local QA only admits an explicit Development key pair and never logs key values', () => {
  assert.equal(clerkQaConfigurationError({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: 'sk_test_fixture',
  }), null)
  for (const key of ['sk_live_synthetic_sensitive', 'invalid_synthetic_sensitive']) {
    const error = clerkQaConfigurationError({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_fixture', CLERK_SECRET_KEY: key,
    })
    assert.match(error, /Production credentials are not permitted/)
    assert.ok(!error.includes(key))
  }
})

test('an intentionally external QA target does not require or provision local Clerk keys', () => {
  assert.equal(clerkQaConfigurationError({ PLAYWRIGHT_BASE_URL: 'https://preview.example.test' }), null)
})
