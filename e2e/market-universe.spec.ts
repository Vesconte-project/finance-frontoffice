import {expect,test} from '@playwright/test'

for(const width of [390,1440]) test(`relationship map requires sign-in at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900})
  await page.emulateMedia({reducedMotion:'reduce'})
  for(const path of ['/markets/network','/stocks/AAPL/relationships']) {
    await page.goto(path)
    await expect(page.getByRole('heading',{name:'Sign in to explore relationships'})).toBeVisible()
    await expect(page.getByRole('link',{name:'Sign in',exact:true}).last()).toHaveAttribute('href','/sign-in')
    await expect(page.locator('[data-relationship-evidence] canvas')).toHaveCount(0)
    expect((await page.request.get('/api/network/atlas')).status()).toBe(401)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  }
})
