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
