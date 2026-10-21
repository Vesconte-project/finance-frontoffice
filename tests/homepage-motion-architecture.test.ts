import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function walkRuntimeFiles(relativeDir: string): string[] {
  const directory = path.join(process.cwd(), relativeDir)
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) return walkRuntimeFiles(relativePath)
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [relativePath] : []
  })
}

test('site scroll has one root runtime with standard, operational, and narrative profiles', () => {
  const agreement = readRepoFile('AGENTS.md')
  const rootLayout = readRepoFile('app/layout.tsx')
  const marketingLayout = readRepoFile('app/(marketing)/layout.tsx')
  const appLayout = readRepoFile('app/(app)/layout.tsx')
  const homepage = readRepoFile('components/marketing/HomePage.tsx')
  const hero = readRepoFile('components/marketing/HeroConstellation.tsx')
  const tickerStory = readRepoFile('components/marketing/HomeTickerStory.tsx')
  const chrome = readRepoFile('components/marketing/SiteChromeMotion.tsx')
  const runtime = readRepoFile('components/motion/ScrollRuntime.tsx')
  const tokens = readRepoFile('components/motion/scroll-tokens.ts')

  assert.match(rootLayout, /ScrollRuntimeProvider defaultProfile="standard"/)
  assert.match(rootLayout, /lenis\/dist\/lenis\.css/)
  assert.doesNotMatch(marketingLayout, /ScrollRuntimeProvider/)
  assert.match(appLayout, /ScrollExperience profile="operational"/)
  assert.match(homepage, /ScrollExperience profile="narrative"/)
  assert.match(runtime, /new Lenis/)
  assert.match(runtime, /gsap\.ticker\.add/)
  assert.match(runtime, /registerScene/)
  assert.match(runtime, /acquireLock/)
  assert.match(runtime, /prefers-reduced-motion: reduce/)
  assert.match(runtime, /native-reduced/)
  assert.match(runtime, /overscroll: false/)
  assert.match(runtime, /stopInertiaOnNavigate: true/)
  assert.match(tokens, /lerp: 0\.1/)
  assert.match(tokens, /cinematic: 1/)

  const lenisOwners = ['app', 'components', 'lib']
    .flatMap(walkRuntimeFiles)
    .filter((file) => /new Lenis\s*\(/.test(readRepoFile(file)))
  assert.deepEqual(lenisOwners, ['components/motion/ScrollRuntime.tsx'])

  assert.match(hero, /runtime\.registerScene/)
  assert.match(hero, /runtime\.acquireLock/)
  assert.doesNotMatch(hero, /from 'lenis'|new Lenis|from 'gsap\/ScrollTrigger'/)

  assert.match(chrome, /runtime\.subscribeScroll/)
  assert.match(tickerStory, /runtime\.subscribeScroll/)
  assert.doesNotMatch(chrome, /addEventListener\('scroll'/)
  assert.doesNotMatch(tickerStory, /addEventListener\('scroll'/)
  assert.match(agreement, /root scroll runtime owns the site's single Lenis instance/i)
})

test('global smooth scroll preserves native nested regions and contains document overscroll', () => {
  const globals = readRepoFile('app/globals.css')
  const tickerSearch = readRepoFile('components/search/TickerSearchCombobox.tsx')
  const atlas = readRepoFile('components/atlas/AtlasExplorer.tsx')
  const dataTable = readRepoFile('components/ui/DataTable.tsx')

  assert.match(globals, /overscroll-behavior-y:\s*none/)
  assert.match(tickerSearch, /data-lenis-prevent/)
  assert.match(atlas, /data-lenis-prevent/)
  assert.match(dataTable, /data-lenis-prevent-horizontal/)
})
