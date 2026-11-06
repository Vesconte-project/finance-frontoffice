import {expect,test} from '@playwright/test'
test('reader sets a thirty-year discounted scenario, sensitivity and history beyond thirty years',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('/stocks/QA30/valuation')
 const block=page.locator('#price-assumes')
 await block.getByRole('spinbutton',{name:'Annual earnings per share growth',exact:true}).fill('10')
 await block.getByRole('spinbutton',{name:'Future P/E',exact:true}).fill('20')
 await block.getByRole('spinbutton',{name:'Return you require per year',exact:true}).fill('10')
 await block.getByRole('spinbutton',{name:'Years from now',exact:true}).fill('30')
 await expect(block).toContainText('Scenario value today · 30 years')
 await expect(block.getByRole('table')).toBeVisible()
 await expect(block).toContainText('Dividends are excluded')
 for(const width of [320,390,480,768,820,1024,1366,1440,1536,1920]){
  await page.setViewportSize({width,height:width===1366?768:900})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true)
  if([390,1366,1920].includes(width))await block.screenshot({path:info.outputPath(`scenario-${width}.png`)})
 }
 await block.getByRole('spinbutton',{name:'Future P/E',exact:true}).fill('99')
 await expect(block.getByRole('table')).toHaveCount(0)
 await expect(block.getByRole('alert')).toContainText("Couldn't load the scenario, try again")
 await expect(block.locator('[data-being-built-badge]')).toHaveCount(0)
 await page.goto('/stocks/QAM/valuation')
 await expect(page.locator('#price-assumes input')).toHaveCount(0)
 await expect(page.locator('#price-assumes [data-being-built-badge]').first()).toBeVisible()
 await page.goto('/stocks/QA30/ownership')
 await expect(page.getByRole('group',{name:'Choose a year'}).getByRole('button',{name:'1991',exact:true})).toHaveCount(1)
 await page.goto('/stocks/QA30/fundamentals')
 await expect(page.getByRole('figure',{name:'Reported revenue by fiscal year, 1991 to 2025',exact:true})).toBeVisible()
 for(const width of [390,1366,1920]){
  await page.setViewportSize({width,height:900})
  await page.locator('#revenue').screenshot({path:info.outputPath(`revenue-35-years-${width}.png`)})
 }
 await page.goto('/stocks/QA30/financials')
 await page.getByRole('combobox',{name:'Fiscal year',exact:true}).selectOption('1991')
 await expect(page.getByRole('combobox',{name:'Fiscal year',exact:true})).toHaveValue('1991')
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.setViewportSize({width:390,height:844})
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true)
 expect(errors).toEqual([])
})


for (const status of [429, 502]) {
 test(`temporary ${status} preserves assumptions and respects Retry-After, including edits`, async ({page}, info) => {
  let requests=0
  let firstResponseAt=0
  let secondRequestAt=0
  await page.route('**/api/stocks/QA30/valuation-scenario?*', async route => {
   requests++
   if(requests===1){
    firstResponseAt=Date.now()
    await route.fulfill({status,headers:{'Retry-After':status===429?'3':new Date(Date.now()+4000).toUTCString(),'Content-Type':'application/json'},body:'{"available":false}'})
   }else{
    secondRequestAt=Date.now()
    await route.continue()
   }
  })
  await page.goto('/stocks/QA30/valuation')
  const block=page.locator('#price-assumes')
  for(const [name,value] of [['Annual earnings per share growth','10'],['Future P/E','20'],['Return you require per year','10'],['Years from now','30']]){
   await block.getByRole('spinbutton',{name,exact:true}).fill(value)
  }
  await expect(block.getByRole('alert')).toContainText("Couldn't load the scenario, try again")
  await expect(block.getByRole('button',{name:'Try again',exact:true})).toBeDisabled()
  await expect(block.locator('[data-being-built-badge]')).toHaveCount(0)
  await expect(block.getByRole('table')).toHaveCount(0)
  await page.setViewportSize({width:390,height:844})
  await block.screenshot({path:info.outputPath(`temporary-${status}.png`)})
  if(status===429){
   // Editing must not bypass the host's minimum delay either.
   await block.getByRole('spinbutton',{name:'Future P/E',exact:true}).fill('21')
   await page.waitForTimeout(500)
   expect(requests).toBe(1)
  }else{
   const retry=block.getByRole('button',{name:'Try again',exact:true})
   await expect(retry).toBeEnabled({timeout:5000})
   expect(requests).toBe(1) // No automatic retry loop.
   await retry.click()
  }
  await expect(block.getByRole('table')).toBeVisible({timeout:8000})
  expect(requests).toBe(2)
  expect(secondRequestAt-firstResponseAt).toBeGreaterThanOrEqual(3000)
  await expect(block.getByRole('spinbutton',{name:'Years from now',exact:true})).toHaveValue('30')
  await expect(block.getByRole('alert')).toHaveCount(0)
 })
}
