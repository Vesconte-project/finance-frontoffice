import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvConfig(root, true)
const action = process.argv[2] || 'up'
if (!['up', 'down', 'reset', 'status'].includes(action)) throw Error('Unknown platform action')
const repos = resolve(root, process.env.FINANCE_REPOS_DIR || '..')
const infra = resolve(repos, 'finance-infra/platform-local')
if (!existsSync(resolve(infra, 'local.py'))) throw Error('Missing sibling finance-infra/platform-local profile')
const port = process.env.FINANCE_BACKEND_PORT || '18095'
const objectPort = process.env.FINANCE_OBJECT_PORT || '19095'
const args = [resolve(infra, 'local.py'), action, '--repos-dir', repos, '--backend-port', port, '--object-port', objectPort]
if (action === 'reset') {
  if (!process.argv.includes('--confirm-project=finance-platform-local'))
    throw Error('Reset deletes this platform project data. Pass --confirm-project=finance-platform-local')
  args.push('--confirm-project', 'finance-platform-local')
}
if (action === 'up') {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_') || !process.env.CLERK_SECRET_KEY?.startsWith('sk_test_'))
    throw Error('Use Clerk Development keys in the private .env.local')
  const inputs = resolve(root, process.env.FINANCE_PLATFORM_INPUTS || resolve(infra, '.state/dev-input.json'))
  if (!existsSync(inputs)) throw Error('Prepare private platform inputs; see finance-infra/platform-local/README.md')
  const config = JSON.parse(readFileSync(inputs, 'utf8'))
  const frontendApi = Buffer.from(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(8), 'base64').toString().replace(/\$$/, '')
  if (`https://${frontendApi}` !== config.CLERK_JWT_ISSUER || config.CLERK_SECRET_KEY !== process.env.CLERK_SECRET_KEY)
    throw Error('Frontend and Backend must use the same Clerk Development instance')
  args.push('--inputs', inputs)
  if (process.env.FINANCE_POSTGRES_PORT) args.push('--postgres-port', process.env.FINANCE_POSTGRES_PORT)
}
const stack = spawnSync('python3', args, { cwd: root, stdio: 'inherit' })
if (stack.error || stack.status !== 0) process.exit(stack.status || 1)
if (action === 'up') {
  const shared = readFileSync(resolve(infra, '.state/secrets/shared'), 'utf8').trim()
  const env = { ...process.env, BACKEND_BASE_URL: `http://127.0.0.1:${port}`, FINANCE_BACKEND_URL: '',
    BACKEND_SHARED_SECRET: shared, CF_ACCESS_CLIENT_ID: '', CF_ACCESS_CLIENT_SECRET: '',
    NEXT_PUBLIC_PLATFORM_API_ENABLED: 'true', NEXT_PUBLIC_PLATFORM_API_BASE_URL: `http://127.0.0.1:${port}`,
    RESEARCH_SYNTHETIC_ENABLED: 'true', NEXT_PUBLIC_RESEARCH_AUTH_MODE: 'clerk_jwt',
    NEXT_PUBLIC_RESEARCH_API_BASE_URL: `http://127.0.0.1:${port}`, VERCEL_ENV: 'development', NEXT_DIST_DIR: '.next-platform' }
  const next = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', 'localhost', '--port', '3000'],
    { cwd: root, env, stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => next.kill(signal))
  next.on('exit', code => process.exit(code || 0))
  console.log('Ctrl+C stops Next.js. Use npm run dev:platform:down to stop this Docker project; volumes are preserved.')
}
