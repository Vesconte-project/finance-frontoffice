import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function classifyChanges(files, beforePackage, afterPackage) {
  let verify = false
  let build = false
  let browser = false
  for (const file of files) {
    if (file === 'app/robots.ts' || file === 'app/sitemap.ts') {
      verify = true
      build = true
    } else if (file === 'package.json') {
      verify = true
      // A unit-test-list edit does not change the app or the browser harness.
      // Every other manifest change conservatively requires full browser QA.
      const withoutTest = value => {
        const copy = structuredClone(value)
        if (copy?.scripts) delete copy.scripts.test
        return copy
      }
      if (!beforePackage || !afterPackage ||
          JSON.stringify(withoutTest(beforePackage)) !== JSON.stringify(withoutTest(afterPackage))) browser = true
    } else if (/^(app\/|components\/|hooks\/|public\/|e2e\/|playwright\.config\.|next\.config\.|postcss\.config\.|proxy\.ts$|vercel\.json$|package-lock\.json$)/.test(file) ||
        ['scripts/ci-scope.mjs', 'scripts/check-browser-qa.mjs', 'scripts/e2e-backend-stub.mjs',
          '.github/workflows/frontend-qa.yml', '.github/workflows/ci.yml'].includes(file)) {
      browser = true
    } else if (/\.(?:[cm]?[jt]sx?|json|toml|ya?ml)$/.test(file) || /^(lib|tests|scripts|supabase)\//.test(file)) {
      verify = true
    }
  }
  return { verify: verify || browser, build: build || browser, browser }
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const head = process.env.HEAD_SHA || 'HEAD'
  const before = process.env.BEFORE
  const base = process.env.EVENT_NAME === 'pull_request'
    ? process.env.PR_BASE
    : before && !/^0+$/.test(before) ? before : git('rev-list', '--max-parents=0', head)
  if (!base) throw new Error('CI scope requires an explicit base revision')
  const files = git('diff', '--no-renames', '--name-only', '-z', base, head).split('\0').filter(Boolean)
  const manifest = ref => {
    // A missing/deleted/invalid manifest must select the full path, not skip QA.
    try { return JSON.parse(git('show', `${ref}:package.json`)) } catch { return undefined }
  }
  const scope = classifyChanges(files, files.includes('package.json') ? manifest(base) : undefined,
    files.includes('package.json') ? manifest(head) : undefined)
  const output = Object.entries(scope).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output)
  process.stdout.write(output)
}
