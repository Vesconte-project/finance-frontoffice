import { createPublicKey } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const action = process.argv[2] || 'up'
if (!['up', 'down', 'reset', 'status'].includes(action)) throw Error('Unknown local action')
const repos = resolve(root, process.env.FINANCE_REPOS_DIR || '..')
const infra = resolve(repos, 'finance-infra/dev-local')
if (!existsSync(resolve(infra, 'local.py'))) throw Error('Missing sibling finance-infra/dev-local profile')
loadEnvConfig(root, true)
const port = process.env.FINANCE_BACKEND_PORT || '18095'
const args = [resolve(infra, 'local.py'), action, '--repos-dir', repos, '--backend-port', port]
if (action === 'reset') {
  if (!process.argv.includes('--confirm-project=finance-local')) throw Error('Reset deletes local jobs and artifacts. Pass --confirm-project=finance-local')
  args.push('--confirm-project', 'finance-local')
}
if (action === 'up') {
  if (!existsSync(resolve(root, '.env.local'))) throw Error('Create .env.local with Clerk Development settings; see README')
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) throw Error('Use Clerk Development keys only')
  const state = resolve(infra, '.state')
  mkdirSync(state, { recursive: true, mode: 0o700 })
  const config = resolve(state, 'clerk-input.json')
  const issuer = process.env.CLERK_JWT_ISSUER
  const publicKey = process.env.CLERK_JWT_PUBLIC_KEY?.replaceAll('\\n', '\n')
  if (!issuer || !publicKey) throw Error('Set CLERK_JWT_ISSUER and CLERK_JWT_PUBLIC_KEY in .env.local')
  const rsa = createPublicKey(publicKey)
  if (rsa.asymmetricKeyType !== 'rsa' || (rsa.asymmetricKeyDetails?.modulusLength || 0) < 2048) throw Error('Use a Clerk RSA JWT public key with at least 2048 bits')
  const frontendApi = Buffer.from(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8), 'base64').toString().replace(/\$$/, '')
  if (`https://${frontendApi}` !== issuer) throw Error('Publishable key and JWT issuer must belong to the same Development instance')
  writeFileSync(config, JSON.stringify({ CLERK_JWT_ISSUER: issuer, CLERK_JWT_PUBLIC_KEY: publicKey, CLERK_JWT_AUTHORIZED_PARTIES: 'http://localhost:3000' }), { mode: 0o600 })
  args.push('--clerk-config', config)
  if (process.env.FINANCE_POSTGRES_PORT) args.push('--postgres-port', process.env.FINANCE_POSTGRES_PORT)
}
const stack = spawnSync('python3', args, { cwd: root, stdio: 'inherit' })
if (stack.error || stack.status !== 0) process.exit(stack.status || 1)
if (action === 'up') {
  const shared = readFileSync(resolve(infra, '.state/secrets/shared'), 'utf8').trim()
  const env = { ...process.env, BACKEND_BASE_URL: `http://127.0.0.1:${port}`, FINANCE_BACKEND_URL: '', BACKEND_SHARED_SECRET: shared, CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: '',
    RESEARCH_SYNTHETIC_ENABLED: 'true', NEXT_PUBLIC_RESEARCH_AUTH_MODE: 'clerk_jwt', NEXT_PUBLIC_RESEARCH_API_BASE_URL: `http://127.0.0.1:${port}`, VERCEL_ENV: 'development', NEXT_DIST_DIR: '.next-local' }
  const next = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: root, env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => next.kill(signal))
  next.on('exit', code => process.exit(code || 0))
  console.log('Ctrl+C stops Next.js; Docker data is preserved. Use npm run dev:local:down to stop Docker.')
}
