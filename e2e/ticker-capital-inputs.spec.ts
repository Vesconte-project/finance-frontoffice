import {expect,test,type Page,type TestInfo} from '@playwright/test'

test.use({hasTouch:true})
async function overflow(page:Page) {
  const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
  expect(size.scroll).toBeLessThanOrEqual(size.width+1)
}
async function capture(page:Page,info:TestInfo,name:string) {await page.screenshot({path:info.outputPath(`${name}.png`),fullPage:true})}

test('cash debt and total dividend amounts render with negative net cash and native currency',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/stocks/QAS/fundamentals')
  await expect(page.getByRole('figure',{name:'Annual cash, debt and net cash',exact:true})).toBeVisible()
  await expect(page.getByRole('figure',{name:'Total annual dividends paid',exact:true})).toBeVisible()
  await expect(page.locator('#dividends')).toContainText('$12B')
  for (const [width,height] of [[320,568],[390,844],[768,1024],[1366,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height});await overflow(page);await capture(page,info,`fundamentals-${width}`)
  }
  await page.setViewportSize({width:390,height:844})
  await page.goto('/stocks/QAM/fundamentals')
  await expect(page.locator('#dividends')).toContainText('€12B')
  await expect(page.getByRole('figure',{name:'Annual cash, debt and net cash',exact:true})).toBeVisible()
  await expect(page.getByRole('figure',{name:'Annual cash, debt and net cash',exact:true})).toContainText('−€30B')
  await overflow(page)
  expect(errors).toEqual([])
})

test('repurchase cash never creates bought back counts or employee issuance',async({page},info)=>{
  await page.goto('/stocks/QAS/ownership')
  await expect(page.getByRole('figure',{name:'Annual cash spent on buybacks',exact:true})).toBeVisible()
  await expect(page.locator('#buybacks')).toContainText('$20B')
  await expect(page.locator('[data-share-row="issued"] [data-being-built-badge]')).toBeVisible()
  await expect(page.locator('[data-share-row="start"]')).toContainText('Shares in 2022')
  await expect(page.getByRole('figure',{name:'Annual shares outstanding',exact:true})).toBeVisible()
  for (const [width,height] of [[320,568],[390,844],[768,1024],[1366,768],[1440,900],[1920,1080]]) {
    await page.setViewportSize({width,height});await overflow(page);await capture(page,info,`ownership-${width}`)
  }
  await page.goto('/stocks/QAM/ownership')
  await expect(page.getByRole('figure',{name:'Annual cash spent on buybacks',exact:true})).toBeVisible()
  await expect(page.locator('#buybacks')).toContainText('€20B')
  await expect(page.locator('[data-share-row="bought"] [data-being-built-badge]')).toBeVisible()
  await expect(page.locator('#shares-outstanding [data-being-built-badge]')).toBeVisible()
  await expect(page.locator('[data-share-row="issued"] [data-being-built-badge]')).toBeVisible()
  await page.goto('/stocks/QAL/fundamentals')
  await expect(page.locator('#cash-and-debt [data-being-built-badge]').first()).toBeVisible()
  await expect(page.getByRole('figure',{name:'Annual cash, debt and net cash',exact:true})).toHaveCount(0)
})

test('capital routes fit intermediate widths, keyboard and reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  for (const route of ['fundamentals','ownership']) {
    await page.goto(`/stocks/QAS/${route}`)
    for (const width of [480,820,1024,1536]) {await page.setViewportSize({width,height:900});await overflow(page)}
    await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
    await overflow(page)
    await page.evaluate(()=>{document.documentElement.style.fontSize=''})
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveCount(1)
  }
})

test('debt says where it comes from, names empty years with their reason and keeps leases apart',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/stocks/QAS/fundamentals')
  const chapter=page.locator('#cash-and-debt')
  await expect(chapter.locator('[data-leases]')).toContainText('$11B')
  const origin=chapter.locator('[data-value-origin]')
  await expect(origin).toBeVisible()
  await expect(origin.locator('[data-composition]')).toBeHidden()
  await origin.getByText('Where debt comes from').click()
  await expect(origin.locator('[data-composition] li')).toHaveCount(2)
  await expect(origin).toContainText('us-gaap:CommercialPaper')
  await expect(origin.locator('[data-accession]')).toHaveText('0000000000-25-000001')
  await expect(origin.locator('[data-empty-reason="definition_changed"]')).toHaveText('No figure for 2021: the two years are measured on different definitions.')
  // Debt itself is unchanged by the leases beside it.
  await expect(page.getByRole('figure',{name:'Annual cash, debt and net cash',exact:true})).toContainText('$80B')
  for (const [width,height] of [[320,568],[390,844],[1440,900]]) {
    await page.setViewportSize({width,height});await overflow(page);await capture(page,info,`fundamentals-origin-${width}`)
  }
  await origin.locator('summary').focus();await page.keyboard.press('Enter')
  await expect(origin.locator('[data-composition]')).toBeHidden()
  expect(errors).toEqual([])
})

test('shares bought back sit beside the cash of the same year, on today’s share basis',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto('/stocks/QAS/ownership')
  const card=page.locator('#buybacks [data-shares-repurchased]')
  await expect(card).toContainText('120M')
  await expect(card).toContainText('on today’s share basis')
  await expect(page.locator('#buybacks')).toContainText('FY2025')
  await expect(page.locator('#shares-outstanding [data-share-basis]')).toBeVisible()
  for (const [width,height] of [[320,568],[390,844],[1440,900]]) {
    await page.setViewportSize({width,height});await overflow(page);await capture(page,info,`ownership-shares-${width}`)
  }
  await page.goto('/stocks/QAM/ownership')
  await expect(page.locator('#buybacks [data-shares-repurchased]')).toHaveCount(0)
  await expect(page.locator('#shares-outstanding [data-share-basis]')).toHaveCount(0)
  expect(errors).toEqual([])
})
