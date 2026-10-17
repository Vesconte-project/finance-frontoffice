import { createRequire } from 'node:module'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
if (process.env.FINANCE_LOCAL_PROJECT) args.push('--project',process.env.FINANCE_LOCAL_PROJECT)
if (action === 'reset') {
  if (!process.argv.includes('--confirm-project=finance-local')) throw Error('Reset deletes local jobs and artifacts. Pass --confirm-project=finance-local')
  args.push('--confirm-project', 'finance-local')
}
if (action === 'up') {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_')) throw Error('Use Clerk Development keys only')
  const state = resolve(infra, '.state')
  mkdirSync(state, { recursive: true, mode: 0o700 })
  const config = resolve(state, 'clerk-input.json')
  const frontendApi = Buffer.from(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8), 'base64').toString().replace(/\$$/, '')
  const issuer = `https://${frontendApi}`
  if (process.env.CLERK_JWT_ISSUER && process.env.CLERK_JWT_ISSUER !== issuer)
    throw Error('Use one matching Clerk Development issuer')
  writeFileSync(config, JSON.stringify({ CLERK_JWT_ISSUER: issuer,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_JWT_AUTHORIZED_PARTIES: 'http://localhost:3000,http://localhost:3101' }), { mode: 0o600 })
  args.push('--clerk-config', config)
  if (process.env.FINANCE_LOCAL_CANDIDATE==='true') args.push('--candidate')
  if (process.env.FINANCE_POSTGRES_PORT) args.push('--postgres-port', process.env.FINANCE_POSTGRES_PORT)
}
const stack = spawnSync('python3', args, { cwd: root, stdio: 'inherit' })
if (stack.error || stack.status !== 0) process.exit(stack.status || 1)
if (action === 'up') {
  const env = { ...process.env, BACKEND_BASE_URL: `http://127.0.0.1:${port}`,
    CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: '', NEXT_PUBLIC_PLATFORM_API_ENABLED: 'true',
    VERCEL_ENV: 'development', NEXT_DIST_DIR: '.next-local' }
  const next = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: root, env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => next.kill(signal))
  next.on('exit', code => process.exit(code || 0))
  console.log('Ctrl+C stops Next.js; Docker data is preserved. Use npm run dev:local:down to stop Docker.')
}
