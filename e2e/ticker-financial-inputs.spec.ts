import { expect, test, type Page, type TestInfo } from '@playwright/test'

test.use({ hasTouch: true })

async function overflow(page: Page) {
  const size = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1)
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true})
}

test('reported costs and supplied percent/growth values work at desktop and mobile sizes', async ({page},info)=>{
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.setViewportSize({width:1440,height:900})
  await page.goto('/stocks/QAS/financials')
  const wide=page.locator('[data-flow-variant="wide"]')
  await expect(wide).toBeVisible()
  await expect(wide.locator('[data-flow-node="costOfSales"]')).toContainText('$')
  await expect(wide.locator('[data-flow-node="taxes"]')).toContainText('Income tax')
  await expect(page.getByRole('heading',{name:'Biggest changes',exact:true})).toBeVisible()
  const units=page.getByRole('radiogroup',{name:'Show amounts or share of sales'})
  await units.getByRole('radio',{name:'% of sales',exact:true}).click()
  await expect(wide.locator('[data-flow-node="costOfSales"]')).toContainText('56%')
  await expect(wide.locator('[data-flow-node="netIncome"]')).toContainText('24%')
  await overflow(page)
  await capture(page,info,'financials-desktop')
  await page.setViewportSize({width:390,height:844})
  const narrow=page.locator('[data-flow-variant="narrow"]')
  await expect(narrow).toBeVisible()
  await expect(narrow.locator('[data-flow-node="operatingCosts"]')).toContainText('14%')
  await narrow.locator('[data-flow-node="operatingCosts"]').tap()
  await expect(page.locator('[data-flow-card="operatingCosts"]')).toBeVisible()
  await overflow(page)
  await capture(page,info,'financials-mobile')
  await page.emulateMedia({reducedMotion:'reduce'})
  await units.getByRole('radio',{name:'Amount',exact:true}).focus()
  await page.keyboard.press('Space')
  await expect(narrow.locator('[data-flow-node="operatingCosts"]')).toContainText('$')
  expect(errors).toEqual([])
})

test('annual growth and margin charts use supplied ratios; unavailable companies keep Being built',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900})
  await page.goto('/stocks/QAS/fundamentals')
  await page.getByRole('radiogroup',{name:'Revenue in'}).getByRole('radio',{name:'% growth',exact:true}).click()
  await expect(page.getByRole('figure',{name:'Annual revenue growth against the year before'})).toBeVisible()
  await expect(page.getByRole('figure',{name:'Annual operating margin'})).toBeVisible()
  await expect(page.locator('#cash-and-debt')).toContainText('$42B')
  await overflow(page)
  await capture(page,info,'fundamentals-desktop')
  await page.setViewportSize({width:390,height:844})
  await overflow(page)
  await capture(page,info,'fundamentals-mobile')
  await page.goto('/stocks/QAM/fundamentals')
  await expect(page.locator('#cash-and-debt')).toContainText('€')
  await page.goto('/stocks/QAM')
  await expect(page.locator('[data-fundamental-card="net-cash"]')).toContainText('€')
  await expect(page.locator('[data-fundamental-card="net-cash"]')).not.toContainText('$')
  await page.goto('/stocks/QAL/financials')
  await expect(page.locator('#sales-flow [data-being-built-badge]')).toHaveCount(2)
  await expect(page.locator('[data-sales-flow]')).toHaveCount(0)
  await overflow(page)
})

test('current multiples display without fabricated history and null latest values suppress older values',async({page},info)=>{
  await page.setViewportSize({width:1440,height:900})
  await page.goto('/stocks/QAS/valuation')
  await expect(page.locator('[data-multiple="pfcf"]')).toContainText('30×')
  await expect(page.locator('[data-multiple="ev-ebitda"]')).toContainText('20×')
  await page.locator('[data-multiple="pfcf"]').click()
  await expect(page.locator('#multiples')).toContainText('30×')
  await overflow(page)
  await capture(page,info,'valuation-desktop')
  await page.setViewportSize({width:390,height:844})
  await overflow(page)
  await capture(page,info,'valuation-mobile')
  await page.goto('/stocks/QAM/valuation')
  await expect(page.locator('[data-multiple="pfcf"] [data-being-built-badge]')).toBeVisible()
  await expect(page.locator('[data-multiple="pfcf"]')).not.toContainText('20×')
})


test('financial routes fit the viewport matrix and enlarged text', async ({page},info)=>{
  for (const route of ['financials','fundamentals','valuation']) {
    await page.goto(`/stocks/QAS/${route}`)
    for (const width of [320,390,480,768,820,1024,1366,1440,1536,1920]) {
      await page.setViewportSize({width,height:900})
      await overflow(page)
      if ([320,768,1366,1920].includes(width)) await capture(page,info,`${route}-${width}`)
    }
    await page.setViewportSize({width:1366,height:900})
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
    await overflow(page)
    await page.evaluate(()=>{document.documentElement.style.fontSize=''})
  }
})
