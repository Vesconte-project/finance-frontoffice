import { expect, test, type Page } from '@playwright/test'

async function selectDetail(page: Page, id: string) {
  await expect(page.locator('[data-flow-variant]:visible')).toHaveCount(1)
  const wide = page.locator('[data-flow-variant="wide"]:visible')
  if (await wide.count()) {
    await wide.locator(`[data-flow-node="${id === 'taxesParts' ? 'taxes' : id}"]`).click()
    if (id === 'taxesParts') await page.getByRole('button',{name:'View interest and income tax',exact:true}).click()
  }
  else {
    const narrow = page.locator('[data-flow-variant="narrow"]:visible')
    await narrow.locator(`[data-flow-node="${id === 'taxesParts' ? 'taxes' : 'operatingCosts'}"]`).click()
    await narrow.locator(`[data-flow-node="${id}"]`).click()
  }
}
const detail = (page: Page, id: string) => page.locator(`[data-statement-detail="${id}"]:visible`)

test('details preserve zero, tax benefits, independent interest lines and missing aggregate costs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/stocks/QAM/financials')
  await selectDetail(page, 'operatingCostsParts')
  const costs = detail(page, 'operatingCostsParts')
  await expect(costs).toHaveCount(1)
  await expect(costs.locator('[data-detail-line="researchAndDevelopment"] [data-detail-value]')).toHaveText('$0')
  await expect(costs.locator('[data-detail-line="sga"] [data-being-built-badge]')).toBeVisible()
  await expect(costs.locator('[data-detail-line="generalAndAdministrative"] [data-detail-value]')).toHaveText('$700M')
  await expect(costs.locator('[data-detail-line="sellingAndMarketing"] [data-detail-value]')).toHaveText('$500M')
  await selectDetail(page, 'taxesParts')
  const taxes = detail(page, 'taxesParts')
  for (const [key, value] of Object.entries({incomeTax:'$-100M',interestExpense:'$0',nonOperatingInterestExpense:'$50M',interestIncome:'$250M',netInterestIncome:'$1.2B'})) {
    await expect(taxes.locator(`[data-detail-line="${key}"] [data-detail-value]`)).toHaveText(value)
  }
  await page.getByRole('radiogroup', { name: 'Fiscal year' }).getByRole('radio', { name: '2024', exact: true }).click()
  await expect(taxes).toHaveCount(0)
  await expect(page.getByText('Interest and income tax for FY2024 is being added.', {exact:true})).toBeVisible()
})

test('percentages require explicit supplied ratios and never divide displayed amounts', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900})
  await page.goto('/stocks/QAS/financials')
  await selectDetail(page, 'operatingCostsParts')
  const costs = detail(page, 'operatingCostsParts')
  await expect(costs).toContainText('Reported separately. These lines can overlap.')
  await expect(costs.locator('[data-detail-line="researchAndDevelopment"]')).toContainText('9% against the year before')
  await page.getByRole('radiogroup', {name:'Show amounts or share of sales'}).getByRole('radio', {name:'% of sales',exact:true}).click()
  await expect(costs.locator('[data-detail-line="researchAndDevelopment"] [data-detail-value]')).toHaveText('6%')
  await expect(costs.locator('[data-detail-line="sga"] [data-detail-value]')).toHaveText('8%')
  await expect(costs.locator('[data-detail-line="generalAndAdministrative"] [data-being-built-badge]')).toBeVisible()
  await expect(costs.locator('[data-detail-line="sellingAndMarketing"] [data-being-built-badge]')).toBeVisible()
})

test('detail controls work with keyboard, narrow layouts, enlarged text and reduced motion', async ({page}, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'dark'})
  await page.goto('/stocks/QAS/financials')
  for (const width of [320,390,480,768,820,1024,1366,1440,1536,1920]) {
    await page.setViewportSize({width,height:900})
    await selectDetail(page,'operatingCostsParts')
    await expect(detail(page,'operatingCostsParts')).toHaveCount(1)
    const size = await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
    expect(size.scroll).toBeLessThanOrEqual(size.width+1)
    if ([390,1366,1920].includes(width)) await page.screenshot({path:info.outputPath(`details-${width}.png`),fullPage:true})
  }
  await page.locator('[data-flow-variant="wide"]:visible [data-flow-node="taxes"]').click()
  const button = page.getByRole('button',{name:'View interest and income tax',exact:true})
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(detail(page,'taxesParts')).toHaveCount(1)
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
  await page.emulateMedia({colorScheme:'light'})
  const size = await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
  expect(size.scroll).toBeLessThanOrEqual(size.width+1)
  expect(errors).toEqual([])
})
