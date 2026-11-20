import { homeStoryScrollProgress } from '../components/marketing/home-story-field'
import { expect, test, type Page } from '@playwright/test'

type Point = { x: number; y: number }
type Dot = Point & { radius: number }
declare global {
  interface Window {
    homeFieldArcs: Dot[]
    homeFocusGeometry: { dots: Point[]; linkEnds: Point[] }
  }
}

async function scrollStory(page: Page, progress: number) {
  const story = page.locator('[data-field-story]')
  await story.evaluate((element, scrollProgress) => {
    const rect = element.getBoundingClientRect()
    const start = Math.max(0, window.scrollY + rect.top - window.innerHeight)
    const end = window.scrollY + rect.bottom - window.innerHeight
    window.scrollTo({
      top: start + (end - start) * scrollProgress,
      behavior: 'instant',
    })
  }, homeStoryScrollProgress(progress))
  await expect.poll(() => story.evaluate((element) =>
    Number((element as HTMLElement).style.getPropertyValue('--story-progress'))
  )).toBeCloseTo(progress, 2)
}

async function recordCanvasDots(page: Page) {
  await page.addInitScript(() => {
    const state = window
    state.homeFieldArcs = []
    state.homeFocusGeometry = { dots: [], linkEnds: [] }
    const { clearRect, arc, lineTo } = CanvasRenderingContext2D.prototype
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.id === 'hc-bg') state.homeFieldArcs = []
      if (this.canvas.id === 'hc-focusFront') state.homeFocusGeometry = { dots: [], linkEnds: [] }
      return clearRect.apply(this, args)
    }
    CanvasRenderingContext2D.prototype.arc = function (...args) {
      const [x, y, radius] = args
      if (this.canvas.id === 'hc-bg') state.homeFieldArcs.push({ x, y, radius })
      if (this.canvas.id === 'hc-focusFront') {
        state.homeFocusGeometry.dots.push(new DOMPoint(x, y).matrixTransform(this.getTransform()))
      }
      return arc.apply(this, args)
    }
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
      if (this.canvas.id === 'hc-focusFront' && Math.abs(this.lineWidth - 1.4) < 0.0001 && typeof this.strokeStyle === 'string') {
        state.homeFocusGeometry.linkEnds.push(new DOMPoint(x, y).matrixTransform(this.getTransform()))
      }
      return lineTo.call(this, x, y)
    }
  })
}

test('one canvas carries a background dot through the relationship orbit and the Atlas', async ({ page }) => {
  await recordCanvasDots(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const dots = () => page.evaluate(() => window.homeFieldArcs)
  await expect.poll(async () => (await dots()).length).toBeGreaterThan(120)
  const background = await dots()

  await scrollStory(page, 0.37)
  const orbitArrival = []
  for (const progress of [0.378, 0.388, 0.398, 0.42]) {
    await scrollStory(page, progress)
    orbitArrival.push(await page.evaluate(() => new Promise<Dot[]>(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.homeFieldArcs)))
    )))
  }
  await scrollStory(page, 0.52)
  await expect(page.locator('[data-market-scene="relationships"] figcaption')).toHaveCount(0)
  const orbitCentre = await page.locator('[data-story-orbit]').evaluate((svg: SVGSVGElement) => {
    const circle = svg.querySelector<SVGCircleElement>('circle[r="15"]')!
    return new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(svg.getScreenCTM()!)
      .toJSON() as { x: number; y: number }
  })
  const centreIndex = async () => (await dots()).findIndex((dot) =>
    Math.hypot(dot.x - orbitCentre.x, dot.y - orbitCentre.y) < 0.5 && dot.radius > 10
  )
  await expect.poll(centreIndex).toBeGreaterThanOrEqual(0)
  const index = await centreIndex()
  for (const frame of orbitArrival) {
    expect(Math.hypot(frame[index].x - orbitCentre.x, frame[index].y - orbitCentre.y)).toBeLessThan(72)
  }

  await scrollStory(page, 0.85)
  const atlas = page.locator('[data-market-scene="atlas"]')
  const distanceToAtlas = () => page.locator('[data-story-atlas]').evaluate((svg: SVGSVGElement, index) => {
    const node = window.homeFieldArcs[index]
    if (!node) return Infinity
    const matrix = svg.getScreenCTM()!
    return Math.min(...[...svg.querySelectorAll<SVGCircleElement>('circle[data-story-static]')].map((dot) => {
      const point = new DOMPoint(dot.cx.baseVal.value, dot.cy.baseVal.value).matrixTransform(matrix)
      return Math.hypot(node.x - point.x, node.y - point.y)
    }))
  }, index)
  await expect.poll(distanceToAtlas).toBeLessThan(0.5)
  expect((await dots()).length).toBe(background.length)
  await expect(atlas.locator('circle[data-story-static]').first()).toHaveCSS('visibility', 'hidden')

  await scrollStory(page, 0.98)
  await expect.poll(distanceToAtlas).toBeLessThan(0.5)
  await expect(atlas).toHaveCSS('opacity', '1')
  const atlasTop = (await atlas.boundingBox())!.y
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect(page.getByRole('contentinfo')).toBeInViewport()
  expect((await atlas.boundingBox())!.y).toBeLessThan(atlasTop - 100)
  await expect.poll(distanceToAtlas).toBeLessThan(0.5)

  await scrollStory(page, 0.52)
  await expect.poll(centreIndex).toBe(index)
  await page.getByRole('link', { name: 'Explore company financials' }).focus()
  await expect(page.locator('[data-market-scene="flow"]')).toHaveAttribute('data-story-active', '')
})

test('the financials enter on the first scroll from the hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const flow = page.locator('[data-market-scene="flow"]')
  await expect(flow).toHaveCSS('opacity', '0')
  await page.mouse.wheel(0, 120)
  await expect(flow.getByRole('heading', { name: 'Where revenue goes' })).toBeInViewport()
  await expect.poll(() => flow.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.55)
})

test('the financials and daily briefing scroll past a shared edge in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const financials = page.locator('[data-market-scene="flow"]')
  const briefing = page.locator('[data-market-scene="updates"]')

  await scrollStory(page, 0.2825)
  const outgoing = (await financials.boundingBox())!
  const incoming = (await briefing.boundingBox())!
  expect(outgoing.y).toBeLessThan(-300)
  expect(incoming.y).toBeGreaterThan(300)
  expect(outgoing.y + outgoing.height).toBeCloseTo(incoming.y, 0)
  await expect(financials).toHaveCSS('opacity', '1')
  await expect(briefing).toHaveCSS('opacity', '1')

  await scrollStory(page, 0.33)
  expect(Math.abs((await briefing.boundingBox())!.y)).toBeLessThan(1)
  await expect(briefing.getByText('Example briefing')).toHaveCount(0)
  await expect(briefing.getByText('Daily score changes are unavailable.')).toBeInViewport()
  await expect(briefing.getByText('Daily sector comparisons are unavailable.')).toBeInViewport()
  await expect(briefing.getByRole('link', { name: 'Create free account' })).toHaveAttribute('href', '/sign-up')
  await scrollStory(page, 0.22)
  await expect(financials.locator('figcaption')).toHaveCount(0)
  expect(Math.abs((await financials.boundingBox())!.y)).toBeLessThan(1)
})

test('the Atlas highlights follow the arriving particles and settle shortly before the footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await recordCanvasDots(page)
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const atlas = page.locator('[data-story-atlas]')
  const tech = atlas.locator('[data-portfolio-layer="tech"]')
  const scroll = () => page.evaluate(() => scrollY)

  await scrollStory(page, 0.68)
  await expect(tech).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.homeFieldArcs.length)).toBeGreaterThan(120)
  const particleCount = await page.evaluate(() => window.homeFieldArcs.length)
  await scrollStory(page, 0.74)
  await expect(tech).toBeHidden()
  await expect.poll(() => page.evaluate(count => {
    const arriving = window.homeFieldArcs.slice(count)
    const particles = window.homeFieldArcs.slice(0, count)
    return arriving.length === 10 && arriving.every(ring => particles.some(dot => dot.x === ring.x && dot.y === ring.y))
  }, particleCount)).toBe(true)

  await scrollStory(page, 0.79)
  await expect(tech).toBeVisible()
  const settled = await scroll()
  await scrollStory(page, 1)
  expect(await scroll() - settled).toBeLessThan(600)
})

test('the camera pulls back through Relationships and keeps turning through the Atlas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await recordCanvasDots(page)
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const canvasDots = () => page.evaluate(() => window.homeFieldArcs)
  const medianDotRadius = async () => {
    const radii = (await canvasDots()).map(({ radius }) => radius).sort((a, b) => a - b)
    return radii[Math.floor(radii.length / 2)]
  }

  await scrollStory(page, 0.42)
  await expect.poll(medianDotRadius).toBeGreaterThan(2.6)
  const approach = await medianDotRadius()
  await scrollStory(page, 0.615)
  await expect.poll(medianDotRadius).toBeLessThan(approach * 0.70)

  await scrollStory(page, 0.84)
  const before = await canvasDots()
  await scrollStory(page, 0.98)
  await expect.poll(async () => {
    const after = await canvasDots()
    return after.filter((dot, index) => Math.hypot(dot.x - before[index].x, dot.y - before[index].y) > 35).length
  }).toBeGreaterThan(before.length * 0.25)
})

test('a particle opens above the homepage and closes at the same scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await recordCanvasDots(page)
  await page.goto('/')
  await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')
  const dialog = page.getByRole('dialog')
  const expectFocus = async () => {
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Back to the network' })).toBeFocused()
    await expect(dialog.locator('#hc-focusDim')).toHaveCSS('opacity', '1')
    await expect(dialog.locator('#hc-focusFront')).toHaveCSS('opacity', '1')
    await expect(dialog.getByRole('link', { name: /Open full page/ })).toHaveAttribute('href', /^\/stocks\//)
  }
  const scrollPosition = () => page.evaluate(() => scrollY)
  await expect.poll(() => page.evaluate(() => window.homeFieldArcs.length)).toBeGreaterThan(120)
  const heroDot = await page.evaluate(() =>
    window.homeFieldArcs
      .filter(({ x, y, radius }) => y > 130 && y < innerHeight - 110
        && x > 36 && x < innerWidth - 36 && radius >= 1.5
        && !document.elementFromPoint(x, y)?.closest('a,button,input,header,nav,[data-dock-search]'))
      .sort((a, b) => b.radius - a.radius)[0]
  )
  expect(heroDot).toBeDefined()
  await page.mouse.move(heroDot.x, heroDot.y)
  expect(await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)
    return target && getComputedStyle(target).cursor
  }, heroDot)).toBe('default')
  await page.mouse.click(heroDot.x, heroDot.y)
  await expectFocus()
  await expect.poll(() => page.evaluate(() => {
    const { dots, linkEnds } = window.homeFocusGeometry
    return linkEnds.length > 0 && linkEnds.every(end => dots.some(dot => Math.hypot(dot.x - end.x, dot.y - end.y) < 1))
  })).toBe(true)
  expect(await scrollPosition()).toBe(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  expect(await scrollPosition()).toBe(0)

  await scrollStory(page, 0.85)
  const atlas = page.locator('[data-market-scene="atlas"]')
  const selection = atlas.getByRole('radio', { name: 'US tech giants' })
  await selection.click()
  await expect(selection).toBeChecked()
  const atlasScroll = await scrollPosition()
  const marker = await atlas.locator('[data-portfolio-layer="tech"] circle').first().boundingBox()
  expect(marker).not.toBeNull()
  await page.mouse.click(marker!.x + marker!.width / 2, marker!.y + marker!.height / 2)
  await expectFocus()
  await expect(dialog.getByRole('link', { name: /Open full page/ })).toHaveAttribute('href', '/stocks/AAPL')
  await page.mouse.wheel(0, 470)
  expect(await scrollPosition()).toBe(atlasScroll)
  await page.mouse.click(30, 150)
  await expect(dialog).toBeHidden()
  expect(await scrollPosition()).toBe(atlasScroll)
  await expect(selection).toBeFocused()
  await expect(selection).toBeChecked()
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`the Atlas switches example portfolios without moving the layout at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('[data-field-story]')).toHaveAttribute('data-field-story-live', '')

    const atlas = page.locator('[data-market-scene="atlas"]')
    await scrollStory(page, 0.85)
    await expect(atlas).toHaveAttribute('data-story-active', '')
    const tech = atlas.getByRole('radio', { name: 'US tech giants' })
    const spread = atlas.getByRole('radio', { name: 'Across markets' })
    const anchorPositions = () => atlas.locator('h2, [role="radiogroup"], [data-story-atlas], a').evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect()
        return [x, y, width, height]
      })
    )
    await expect(tech).toBeChecked()
    const initialLayout = await anchorPositions()
    await spread.click()
    await expect(spread).toBeChecked()
    await expect(atlas.locator('[data-portfolio-copy="spread"]')).toBeVisible()
    await expect(atlas.locator('[data-portfolio-layer="spread"]')).toBeVisible()
    await expect(atlas.locator('[data-portfolio-layer="tech"]')).toBeHidden()
    expect(await anchorPositions()).toEqual(initialLayout)
    await spread.press('ArrowLeft')
    await expect(tech).toBeChecked()
    expect(await anchorPositions()).toEqual(initialLayout)
  })
}
