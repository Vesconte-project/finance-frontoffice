import assert from 'node:assert/strict'
import test from 'node:test'
import { atlasOverviewPath, parseAccess, parseCompanyPanel, parseOverview, type AtlasNode, type AtlasPoint } from '../lib/atlas-model'
import {
  PRO_COPY,
  alignWeek,
  applySimilarity,
  basketCentre,
  cohesionChart,
  compareChart,
  farTies,
  flowArrow,
  frameAt,
  groupKey,
  influenceArrow,
  influencePill,
  influenceSentence,
  insidePolygon,
  loadList,
  meanAccuracy,
  noteDetails,
  noteTitle,
  parseGroups,
  parseNotes,
  pathOf,
  playWeek,
  procrustes,
  saveList,
  selectionSummary,
  shortBasket,
  testRows,
  thenAndNow,
  timelineNote,
  todayFrame,
  weekLabel,
  type StorageLike,
  type WeekFrame,
} from '../lib/atlas-pro'
import {
  atlasSetKey,
  parseCompare,
  parseInfluence,
  parseMovement,
  parseTest,
  parseThemeDetail,
  parseThemes,
  parseWeeks,
} from '../lib/atlas-pro-model'

const proAccess = { tier: 'pro', maxLevel: 3, historyWeeks: 52, lines: true, bundleTies: true, truePositions: true, movement: true, pro: true }

function node(symbol: string, x: number, y: number, extra: Partial<AtlasNode> = {}): AtlasNode {
  return { symbol, name: null, zoneId: 'z', x, y, level: 0, size: 0, bulk: 0.1, reach: null, well: null, loner: false, memberships: [], fidelity: null, themes: [], marketCap: null, ...extra }
}

const close = (a: number, b: number, digits = 6) => assert.ok(Math.abs(a - b) < 10 ** -digits, `${a} ≈ ${b}`)

test('access reads Pro from the flag or the tier, and nobody else is Pro', () => {
  assert.equal(parseAccess(proAccess)?.pro, true)
  assert.equal(parseAccess({ ...proAccess, pro: undefined })?.pro, true)
  assert.equal(parseAccess({ tier: 'free', maxLevel: 3, historyWeeks: 0 })?.pro, false)
  assert.equal(parseAccess({ tier: 'free', pro: 'yes' })?.pro, false)
})

test('the overview reads the new signed-in and Pro fields, and stays residual unless it says total', () => {
  const atlas = parseOverview({
    asOf: '2026-10-16', access: proAccess, level: 1, lens: 'total',
    zones: [{ zoneId: 'a', label: 'A', memberCount: 2, contour: { type: 'circle', x: 0, y: 0, radius: 1 }, contourByValue: { type: 'circle', x: 0, y: 0, radius: 1.4 } }],
    nodes: [
      { symbol: 'AAA', zoneId: 'a', x: 0, y: 0, level: 0, fidelity: 0.7, themes: ['ai', 'ai', 'bad id!', 4], marketCap: 5e9 },
      { symbol: 'BBB', zoneId: 'a', x: 1, y: 0, level: 0, fidelity: 1.4 },
    ],
  })
  assert.ok(atlas)
  assert.equal(atlas.lens, 'total')
  assert.deepEqual(atlas.zones[0].contourByValue, { type: 'circle', x: 0, y: 0, radius: 1.4 })
  assert.equal(atlas.nodes[0].fidelity, 0.7)
  assert.deepEqual(atlas.nodes[0].themes, ['ai'])
  assert.equal(atlas.nodes[0].marketCap, 5e9)
  // out of range is not a fidelity
  assert.equal(atlas.nodes[1].fidelity, null)
  assert.equal(parseOverview({ asOf: '2026-10-16', access: proAccess, zones: [], nodes: [] })?.lens, 'residual')
})

test('the company panel reads totals, trends and themes, and drops what is malformed', () => {
  const panel = parseCompanyPanel({
    asOf: '2026-10-16', access: proAccess, symbol: 'AAA', zoneId: 'a', fidelity: 0.6,
    themes: [{ themeId: 'ai', label: 'AI' }, { themeId: 'ai' }, { label: 'no id' }],
    neighbours: [
      { symbol: 'BBB', correlation: 0.5, total: 0.6, trend: 'stronger' },
      { symbol: 'CCC', correlation: 0.4, total: 3, trend: 'sideways' },
    ],
  })
  assert.ok(panel)
  assert.deepEqual(panel.themes, [{ themeId: 'ai', label: 'AI' }])
  assert.equal(panel.fidelity, 0.6)
  assert.deepEqual(panel.neighbours.map((item) => [item.total, item.trend]), [[0.6, 'stronger'], [null, null]])
})

test('overview paths carry an earlier week and the total lens only when asked', () => {
  assert.equal(atlasOverviewPath(1, null, { lens: 'residual' }), '/api/atlas?level=1')
  assert.equal(atlasOverviewPath(3, null, { asOf: '2026-01-02', lens: 'total' }), '/api/atlas?level=3&asOf=2026-01-02&lens=total')
  assert.equal(atlasOverviewPath(3, null, { asOf: 'not a date' }), '/api/atlas?level=3')
})

test('weeks are newest first and cohesion follows them, oldest first, one per week', () => {
  const weeks = parseWeeks({ weeks: ['2026-10-02', '2026-10-16', '2026-10-09', 'nope'], cohesion: [{ asOf: '2026-10-16', value: 0.1 }, { asOf: '2026-10-02', value: 7 }] })
  assert.ok(weeks)
  assert.deepEqual(weeks.weeks, ['2026-10-16', '2026-10-09', '2026-10-02'])
  assert.deepEqual(weeks.cohesion, [{ asOf: '2026-10-02', value: null }, { asOf: '2026-10-09', value: null }, { asOf: '2026-10-16', value: 0.1 }])
  assert.equal(parseWeeks({ weeks: [] }), null)
})

test('movement keeps aligned moves and drops single-company or malformed flows', () => {
  const movement = parseMovement({
    from: '2026-04-17', to: '2026-10-16', noise: 0.8,
    moves: [
      { symbol: 'AAA', fromZoneId: 'b', toZoneId: 'a', fromX: 1, fromY: 2, move: 3.2, shareGain: 0.5, tiesIn: ['X', 'Y', 'Y'], tiesOut: ['Z'], flow: true },
      { symbol: 'AAA', fromZoneId: 'b', toZoneId: 'a' },
      { symbol: 'BBB', fromZoneId: 'a', toZoneId: 'a', fromX: 'x' },
    ],
    flows: [
      { fromZoneId: 'b', toZoneId: 'a', symbols: ['AAA'], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { fromZoneId: 'c', toZoneId: 'a', symbols: ['AAA', 'CCC', 'DDD'], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { fromZoneId: 'b', toZoneId: 'a', symbols: ['EEE', 'FFF'], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { fromZoneId: 'a', toZoneId: 'a', symbols: ['GGG', 'HHH'], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    ],
  })
  assert.ok(movement)
  assert.equal(movement.moves.length, 2)
  assert.deepEqual(movement.moves[0].from, [1, 2])
  assert.deepEqual(movement.moves[0].tiesIn, ['X', 'Y'])
  assert.equal(movement.moves[1].from, null)
  assert.equal(movement.moves[1].flow, false)
  assert.deepEqual(movement.flows.map((flow) => flow.symbols.length), [3, 2])
  assert.equal(movement.noise, 0.8)
})

test('themes, a theme with members, and influence read defensively', () => {
  const themes = parseThemes({ themes: [{ themeId: 'ai', label: 'AI', memberCount: 4, cohesion: 0.3, typicalCohesion: 0.4, verdict: 'together', regions: [{ zoneId: 'a', share: 0.5 }, { zoneId: 'b', share: 2 }] }, { label: 'none' }] })
  assert.deepEqual(themes?.map((theme) => [theme.themeId, theme.verdict, theme.regions.length]), [['ai', 'together', 1]])
  assert.equal(parseThemes({}), null)
  const detail = parseThemeDetail({ theme: { themeId: 'ai', label: 'AI' }, members: [{ symbol: 'AAA', zoneId: 'a', x: 0, y: 0 }, { symbol: 'BAD' }] })
  assert.deepEqual(detail?.members.map((member) => member.symbol), ['AAA'])
  const influence = parseInfluence({
    tested: true,
    arrows: [
      { from: { basket: 'x', label: 'X', members: ['A'] }, to: { basket: 'y', label: 'Y (Z)', members: ['B'] }, sign: -1, t: -4.4, reportDays: 152, isNew: true },
      { from: { basket: 'x' }, to: { basket: 'x' }, sign: 1, t: 4 },
      { from: { basket: 'x' }, to: { basket: 'y' }, sign: 0, t: 4 },
    ],
  })
  assert.equal(influence?.arrows.length, 1)
  assert.deepEqual(parseInfluence({ tested: false, reason: 'needs_two_years', arrows: [{}] }), { asOf: null, tested: false, reason: 'needs_two_years', arrows: [] })
})

test('compare and the link test read both shapes, and an unavailable test says so', () => {
  const compare = parseCompare({ a: { label: 'A', count: 6 }, b: { label: 'B', count: 3 }, series: [{ value: 0.2 }, { value: 9 }], year: 0.31 })
  assert.equal(compare?.series.length, 1)
  assert.equal(compare?.firstHalf, null)
  assert.equal(parseCompare({ a: { label: 'A' } }), null)
  const flat = parseTest({ reportDays: 31, reportDaysPass: true, sameDayT: -3.6, direction: 'down', permutationP: 0.004, reverseP: { value: 0.4, pass: true } })
  assert.ok(flat && flat.available)
  assert.deepEqual(flat.reportDays, { value: 31, pass: true })
  assert.deepEqual(flat.reverseP, { value: 0.4, pass: true })
  assert.deepEqual(flat.permutationP, { value: 0.004, pass: null })
  assert.deepEqual(parseTest({ available: false, reason: 'no_report_dates' }), { available: false, reason: 'no_report_dates' })
  assert.equal(parseTest({ direction: 'up' }), null)
})

test('every reader reads its own output again unchanged, as the local routes pass parsed answers on', () => {
  const again = <T>(parse: (value: unknown) => T | null, raw: unknown) => {
    const once = parse(raw)
    assert.ok(once)
    assert.deepEqual(parse(JSON.parse(JSON.stringify(once))), once)
  }
  again(parseWeeks, { weeks: ['2026-10-16', '2026-10-09'], cohesion: [{ asOf: '2026-10-16', value: 0.1 }] })
  again(parseMovement, {
    from: '2026-04-17', to: '2026-10-16', noise: 0.5,
    moves: [{ symbol: 'A', fromZoneId: 'b', toZoneId: 'a', fromX: 1, fromY: 2, move: 2, shareGain: 0.4, tiesIn: ['B'], tiesOut: [], flow: true }],
    flows: [{ fromZoneId: 'b', toZoneId: 'a', symbols: ['A', 'B'], from: { x: 0, y: 1 }, to: { x: 2, y: 3 } }],
  })
  again(parseThemes, { themes: [{ themeId: 'ai', label: 'AI', memberCount: 2, regions: [{ zoneId: 'a', label: 'A', share: 0.5 }] }] })
  again(parseThemeDetail, { theme: { themeId: 'ai', label: 'AI' }, members: [{ symbol: 'A', zoneId: 'a', x: 0, y: 0, marketCap: 5e9, themes: ['ai'] }] })
  again(parseInfluence, { tested: true, arrows: [{ from: { basket: 'x', label: 'X', members: ['A'] }, to: { basket: 'y', label: 'Y', zoneId: 'b', members: [] }, sign: 1, t: 4, reportDays: 20 }] })
  again(parseCompare, { a: { label: 'A', count: 2 }, b: { label: 'B', count: 3 }, series: [{ asOf: '2026-10-16', value: 0.2 }], year: 0.3 })
  again(parseTest, { reportDays: 31, reportDaysPass: true, sameDayT: -3, direction: 'down', permutationP: 0.01, from: { label: 'A', count: 6 }, to: { count: 1 } })
  again(parseTest, { available: false, reason: 'needs_two_years' })
})

test('set keys follow the backend syntax and refuse anything else', () => {
  assert.equal(atlasSetKey('zone:fx-zone-alpha'), 'zone:fx-zone-alpha')
  assert.equal(atlasSetKey('group:aaa, BBB,aaa'), 'group:AAA,BBB')
  assert.equal(atlasSetKey('msft'), 'MSFT')
  assert.equal(atlasSetKey('group:'), null)
  assert.equal(atlasSetKey('zone:../x'), null)
  assert.equal(atlasSetKey(`group:${Array.from({ length: 201 }, (_, i) => `S${i}`).join(',')}`), null)
  assert.equal(groupKey(['B', 'A', 'B']), 'group:A,B')
})

test('Procrustes undoes a turn, a scale, a shift and a mirror', () => {
  const target: AtlasPoint[] = [[0, 0], [2, 0], [0, 1], [3, 3], [-1, 2]]
  const turned = target.map(([x, y]): AtlasPoint => {
    const a = 0.7
    return [1.8 * (x * Math.cos(a) - y * Math.sin(a)) + 5, 1.8 * (x * Math.sin(a) + y * Math.cos(a)) - 2]
  })
  const fit = procrustes(turned, target)
  assert.ok(fit)
  turned.forEach((point, i) => {
    const [x, y] = applySimilarity(fit, point)
    close(x, target[i][0])
    close(y, target[i][1])
  })
  const mirrored = target.map(([x, y]): AtlasPoint => [x, -y])
  const flip = procrustes(mirrored, target)
  assert.ok(flip)
  mirrored.forEach((point, i) => {
    const [x, y] = applySimilarity(flip, point)
    close(x, target[i][0])
    close(y, target[i][1])
  })
  assert.equal(procrustes([[0, 0], [1, 1]], [[0, 0], [1, 1]]), null)
})

test('an earlier week aligns onto today, outlines and all, and play moves between frames', () => {
  const today = [node('A', 0, 0), node('B', 2, 0), node('C', 0, 2), node('D', 2, 2)]
  const before = today.map((item) => ({ ...item, x: -item.y, y: item.x }))
  before[3] = { ...before[3], x: before[3].x - 1 }
  const zone = { zoneId: 'z', label: 'Z', memberCount: 4, x: 0, y: 1, contour: { type: 'circle' as const, x: 0, y: 1, radius: 1 }, contourByValue: null, leaders: [], labelSource: null, labelSupport: null, dominantSector: null, totalMarketCap: null, cohesion: null, fidelity: null }
  const frame0 = todayFrame('2026-10-16', today, [])
  const frame1 = alignWeek('2026-10-09', before, [zone], frame0.positions)
  assert.ok(frame1)
  const a = frame1.positions.get('A')
  assert.ok(a)
  close(a[0], 0, 0.3)
  // the circle turned with the map and kept its radius (the turn has no scale)
  assert.equal(frame1.zones[0].contour?.type, 'circle')
  const frames: Array<WeekFrame | undefined> = [frame0, frame1]
  const halfway = frameAt(frames, 0.5)
  assert.ok(halfway)
  const b0 = frame0.positions.get('B') as AtlasPoint
  const b1 = frame1.positions.get('B') as AtlasPoint
  const mid = halfway.positions.get('B') as AtlasPoint
  close(mid[0], (b0[0] + b1[0]) / 2)
  // a missing frame borrows its nearest neighbour
  assert.equal(frameAt([frame0, undefined, frame1], 1.2)?.asOf, frame0.asOf)
  assert.deepEqual(pathOf('A', frames, 1, 0, [0, 0]).length, 3)
  assert.deepEqual(pathOf('Q', frames, 1, 0, null), [])
})

test('the time bar reads dates, plays a year in nine seconds and steps whole weeks with reduced motion', () => {
  assert.equal(weekLabel(['2026-10-16', '2026-10-09'], 0), 'Today')
  assert.equal(weekLabel(['2026-10-16', '2026-10-09'], 1.2), '2026-10-09')
  close(playWeek(52, 4500, false), 26)
  assert.equal(playWeek(52, 4400, true), 27)
  assert.equal(playWeek(10, 99999, false), 0)
  assert.equal(timelineNote(52, null), 'Paths: the companies that changed region over the past year · select any company to see its own')
  assert.equal(timelineNote(52, { symbol: 'AAA', changed: true }), 'Path of AAA since a year ago · it changed region')
  assert.equal(timelineNote(26, { symbol: 'AAA', changed: false }), 'Path of AAA since six months ago · it kept its region')
})

test('arrows bow to opposite sides, widen with their weight and skip what is too short', () => {
  const flow = flowArrow([0, 0], [100, 0], 4)
  const influence = influenceArrow([0, 0], [100, 0], -5)
  assert.ok(flow && influence)
  close(flow.width, 1.5 + 1.6 * 2)
  close(influence.width, 4)
  assert.ok(flow.control[1] > 0 && influence.control[1] < 0)
  assert.ok(flow.end[0] < 100)
  assert.equal(flowArrow([0, 0], [5, 5], 2), null)
  assert.deepEqual(basketCentre(['A', 'B', 'Q'], new Map<string, AtlasPoint>([['A', [0, 0]], ['B', [2, 2]]]), null), [1, 1])
  assert.deepEqual(basketCentre(['Q'], new Map(), [5, 5]), [5, 5])
})

test('influence copy names the groups without their region', () => {
  const arrow = {
    from: { basket: 'x', label: 'Fixture Gamma', zoneId: null, members: [] },
    to: { basket: 'y', label: 'Fixture Tools (Fixture Beta)', zoneId: null, members: [] },
    sign: -1 as const, t: -4.4, reportDays: 152, h1: null, h2: null, isNew: true,
  }
  assert.equal(shortBasket('Glass_makers (Materials)'), 'Glass makers')
  assert.equal(influencePill(arrow), 'Fixture Gamma → Fixture Tools ↓ · new')
  assert.equal(influenceSentence(arrow), 'When Fixture Gamma companies report results, Fixture Tools falls the same day, and not the other way round. Seen on 152 report days, in both years; not seen a year earlier.')
})

test('"Then and now" follows the prototype wording', () => {
  const label = (id: string) => ({ a: 'Alpha', b: 'Beta' })[id] ?? id
  const moved = thenAndNow({ symbol: 'AAA', fromZoneId: 'b', toZoneId: 'a', from: [0, 0], move: 3, shareGain: 0.5, tiesIn: ['X'], tiesOut: ['Y'], flow: true }, 1, 26, label)
  assert.equal(moved.when, '6 months ago')
  assert.equal(moved.verdict, 'Moved to Alpha')
  assert.deepEqual(moved.region.map((part) => part.text).join(''), 'Main region: Beta → Alpha')
  assert.equal(moved.movement, 'Moved 3.0× more than a typical company')
  const steady = thenAndNow({ symbol: 'AAA', fromZoneId: 'a', toZoneId: 'a', from: null, move: 1, shareGain: 0.12, tiesIn: [], tiesOut: [], flow: false }, 1, 52, label)
  assert.equal(steady.verdict, 'Within normal variation')
  assert.equal(steady.region.map((part) => part.text).join(''), 'Weight moved toward Alpha (+12 pts)')
  assert.equal(steady.movement, 'Moved about as much as a typical company')
  assert.equal(thenAndNow({ ...steady, symbol: 'A', fromZoneId: 'a', toZoneId: 'a', from: null, move: null, shareGain: null, tiesIn: [], tiesOut: [], flow: false }, null, 52, label).movement, null)
})

test('the cohesion and compare charts follow the prototype geometry', () => {
  const chart = cohesionChart([0.1, null, 0.3])
  assert.ok(chart)
  assert.equal(chart.points, '4.0,62.0 296.0,16.0')
  assert.equal(chart.label, 'Average correlation over the last year, from 0.10 to 0.30; today 0.30')
  assert.equal(cohesionChart([0.1, null]), null)
  const compare = compareChart([0, 1, -2])
  assert.ok(compare)
  assert.equal(compare.path, 'M6.0,80.6L280.0,12.0L554.0,108.0')
})

test('the link test table applies the thresholds, and the backend marks win', () => {
  const result = parseTest({ reportDays: 31, sameDayT: -3.6, direction: 'down', permutationP: 0.02, reverseP: 0.41, firstHalfT: -2.4, secondHalfT: -1.2, placeboT: 0.6, placeboTPass: false })
  assert.ok(result)
  const rows = testRows(result, 2)
  assert.ok(rows)
  assert.deepEqual(rows.map((row) => row.pass), [true, true, true, true, false, false])
  assert.equal(rows[2].rule, '< 0.025 (0.05 ÷ 2 tests)')
  assert.equal(rows[1].rule, 'down')
  assert.equal(testRows({ available: false, reason: null }, 1), null)
})

test('selection, accuracy and far ties come from what is on the map', () => {
  const nodes = new Map([['A', node('A', 0, 0, { marketCap: 2e9, zoneId: 'x' })], ['B', node('B', 1, 0, { zoneId: 'y' })]])
  assert.deepEqual(selectionSummary(new Set(['A', 'B', 'Q']), nodes), { companies: 3, regions: 2, marketCap: 2e9 })
  assert.equal(meanAccuracy([node('A', 0, 0, { fidelity: 0.7 }), node('B', 0, 0, { fidelity: 0.8 }), node('C', 0, 0)]), '7.5 of 10')
  assert.equal(meanAccuracy([node('A', 0, 0)]), null)
  const ring = Array.from({ length: 12 }, (_, i) => node(`N${i}`, i + 1, 0))
  const far = farTies('S', ['N0', 'N11', 'NONE'], [node('S', 0, 0), ...ring])
  assert.deepEqual(far, ['N11'])
  assert.equal(insidePolygon([[0, 0], [10, 0], [10, 10], [0, 10]], 5, 5), true)
  assert.equal(insidePolygon([[0, 0], [10, 0], [10, 10], [0, 10]], 15, 5), false)
})

test('the reader’s groups and notebook survive blocked storage and drop malformed entries', () => {
  const memory = new Map<string, string>()
  const storage: StorageLike = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => void memory.set(key, value) }
  const blocked: StorageLike = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.deepEqual(loadList(blocked, 'k'), [])
  assert.equal(saveList(blocked, 'k', [1]), false)
  assert.equal(saveList(null, 'k', [1]), false)
  memory.set('bad', '{not json')
  assert.deepEqual(loadList(storage, 'bad'), [])
  assert.equal(saveList(storage, 'groups', [{ id: 'g1', name: 'Mine', members: ['AAA', 'AAA', 'BBB'] }, { id: 'g2', name: '', members: ['X'] }]), true)
  assert.deepEqual(parseGroups(loadList(storage, 'groups')), [{ id: 'g1', name: 'Mine', members: ['AAA', 'BBB'] }])
  const notes = parseNotes([
    { id: 'n1', title: 'AAA', savedAt: '2026-10-16T00:00:00Z', note: 'look', view: { week: 3, cmp: 52, theme: 'ai', lens: 'total', node: 'AAA', multi: ['B'], layers: { inf: true }, cam: { cx: 1, cy: 2, k: 3 }, dock: { kind: 'test', a: 'zone:a', b: 'AAA' } } },
    { id: 'n2', title: 'x', savedAt: 'y' },
  ])
  assert.equal(notes.length, 1)
  assert.equal(notes[0].view.cmp, 52)
  assert.deepEqual(notes[0].view.layers, { inf: true, fid: false, cap: false })
  assert.equal(noteDetails(notes[0].view), '3 weeks ago · 1 selected · test · influence')
  assert.equal(noteTitle({ ...notes[0].view, node: null, multi: [] }, null), 'Whole market')
})

test('every locked feature has its upsell copy, and the timeline follows ENG-232', () => {
  assert.equal(Object.keys(PRO_COPY).length, 12)
  assert.deepEqual(PRO_COPY.timeline, ['A year of history', 'Earlier weeks, and how companies moved between regions, are part of Pro.'])
})
