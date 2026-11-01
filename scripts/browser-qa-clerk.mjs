/** Configuration admission only; the browser runtime still verifies real Clerk. */
export function clerkQaConfigurationError(env) {
  if (env.PLAYWRIGHT_BASE_URL?.trim()) return null
  const publicKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim()
  const secretKey = env.CLERK_SECRET_KEY?.trim()
  if (!publicKey || !secretKey) return 'Existing Clerk Development keys are required before starting local browser QA; keyless provisioning is disabled.'
  if (!publicKey.startsWith('pk_test_') || !secretKey.startsWith('sk_test_'))
    return 'Local browser QA requires Clerk Development keys; Production credentials are not permitted.'
  return null
}
