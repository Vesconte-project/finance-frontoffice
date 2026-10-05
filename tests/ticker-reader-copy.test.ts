import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import type * as TypeScript from 'typescript'

// Tests compile to a temporary directory, so the compiler is loaded from the
// repository explicitly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require(path.join(process.cwd(), 'node_modules', 'typescript')) as typeof TypeScript

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function walk(relativeDir: string, pattern: RegExp): string[] {
  const directory = path.join(process.cwd(), relativeDir)
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) return walk(relativePath, pattern)
    return pattern.test(entry.name) ? [relativePath] : []
  })
}

/**
 * Text a reader can see: JSX text and string literals, minus module specifiers
 * and the arguments of server-side logging calls.
 */
function visibleStrings(relativePath: string): Array<{ text: string; line: number }> {
  const source = ts.createSourceFile(relativePath, readRepoFile(relativePath), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Array<{ text: string; line: number }> = []
  const isLogCall = (node: TypeScript.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent)) {
        const callee = parent.expression.getText(source)
        if (/^console\.|logStockPageEvent|logEvent|logger\./.test(callee)) return true
      }
    }
    return false
  }
  const visit = (node: TypeScript.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportTypeNode(node) || ts.isLiteralTypeNode(node)) return
    if (ts.isJsxText(node) || ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      const text = node.text.trim()
      if (text && !isLogCall(node)) found.push({ text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

const TICKER_SURFACES = [
  ...walk('components/stocks', /\.tsx$/),
  ...walk('app/(app)/stocks/[ticker]', /\.tsx$/),
]

// Internal language the ticker page must never show (Spec: "Página de ticker —
// leitura em camadas V1", Being built rule and acceptance criteria).
const FORBIDDEN = /\b(canonical|contract|payload|finance-backend)\b|Pending integration|Integration pending|Data pending/i

test('no visible text on the ticker page uses internal language', () => {
  const offenders = TICKER_SURFACES.flatMap((file) =>
    visibleStrings(file)
      .filter(({ text }) => FORBIDDEN.test(text))
      .map(({ text, line }) => `${file}:${line} "${text.slice(0, 80)}"`),
  )
  assert.deepEqual(offenders, [])
})

test('the scan covers every ticker tab and the shared research primitives', () => {
  for (const file of [
    'components/stocks/StockOverviewClient.tsx',
    'components/stocks/StockOwnershipResearch.tsx',
    'components/stocks/StockBusinessResearch.tsx',
    'components/stocks/StockSignalsResearch.tsx',
    'components/stocks/StockMethodologyResearch.tsx',
    'components/stocks/research/BeingBuilt.tsx',
    'components/stocks/research/ResearchChapter.tsx',
    'components/stocks/research/ChartFrame.tsx',
    'app/(app)/stocks/[ticker]/page.tsx',
    'app/(app)/stocks/[ticker]/relationships/page.tsx',
  ]) assert.ok(TICKER_SURFACES.includes(file), `${file} is not scanned`)
  // The scanner itself must see the words it is meant to forbid.
  assert.ok(FORBIDDEN.test('Pending integration') && FORBIDDEN.test('the canonical summary'))
  assert.ok(!FORBIDDEN.test('Being built'))
})

test('a block waiting for data shows the badge and a sentence, never a value', () => {
  const beingBuilt = readRepoFile('components/stocks/research/BeingBuilt.tsx')
  assert.match(beingBuilt, />Being built</)
  assert.match(beingBuilt, /data-being-built\b/)
  assert.doesNotMatch(beingBuilt, /value\s*[?:]/, 'BeingBuilt takes no value to show')
  for (const file of ['components/stocks/StockOwnershipResearch.tsx', 'components/stocks/StockBusinessResearch.tsx', 'components/stocks/StockSignalsResearch.tsx']) {
    assert.match(readRepoFile(file), /from '@\/components\/stocks\/research\/BeingBuilt'/, `${file} uses the shared Being built block`)
  }
})

test('research primitives respond to their own width and use only the semantic palette', () => {
  const chapter = readRepoFile('components/stocks/research/ResearchChapter.module.css')
  const chart = readRepoFile('components/stocks/research/ChartFrame.module.css')
  const being = readRepoFile('components/stocks/research/BeingBuilt.module.css')
  assert.match(chapter, /container:\s*research-chapter\s*\/\s*inline-size/)
  assert.match(chapter, /@container research-chapter \(width >= 56rem\)/)
  assert.match(chapter, /position:\s*sticky/)
  assert.match(chart, /container:\s*research-chart\s*\/\s*inline-size/)
  assert.match(chart, /@container research-chart \(width >= 32\.5rem\)/)
  assert.match(chart, /vector-effect:\s*non-scaling-stroke/)
  assert.match(chart, /pointer-events:\s*none/)
  for (const css of [chapter, chart, being]) {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'literal colours belong in app/globals.css')
    assert.doesNotMatch(css, /@media \((min|max)-width/, 'layout follows the component width, not the device')
  }
  // Chart labels are page text over the drawing, never SVG text.
  assert.doesNotMatch(readRepoFile('components/stocks/research/ChartFrame.tsx'), /<text\b/)
})
