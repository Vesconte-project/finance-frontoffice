import {test,expect,type Page} from '@playwright/test'
import {clerk,clerkSetup} from '@clerk/testing/playwright'
import {createClerkClient} from '@clerk/backend'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'

const backend='http://127.0.0.1:18095'
const repos=resolve(process.env.FINANCE_REPOS_DIR || '..')
const api=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY})
const execute=promisify(execFile)
const run=Date.now().toString()
const emails=[0,1].map(i=>`vesconte-cutover-${run}-${i}+clerk_test@example.com`)
const users:string[]=[]
const results:Record<string,string>={}
const profile=resolve(repos,'finance-infra/dev-local')
const admin=(...args:string[])=>execute('python3',[resolve(profile,'admin.py'),'--repos-dir',repos,'--project','finance-local-eng196',...args],{timeout:90_000})
async function request(page:Page,path:string,method='GET',body?:unknown) {
  return page.evaluate(async({backend,path,method,body})=>{
    const state=window as unknown as {Clerk:{session:{getToken:()=>Promise<string>}}}
    const token=await state.Clerk.session.getToken()
    const response=await fetch(backend+path,{method,headers:{Authorization:`Bearer ${token}`,
      ...(body===undefined?{}:{'Content-Type':'application/json'})},credentials:'omit',cache:'no-store',
      ...(body===undefined?{}:{body:JSON.stringify(body)})})
    return {status:response.status,body:await response.json()}
  },{backend,path,method,body})
}
test.beforeAll(async()=>{
  await clerkSetup()
  for(const email of emails){const user=await api.users.createUser({emailAddress:[email],skipPasswordRequirement:true});users.push(user.id)}
})
test.afterAll(async()=>{
  for(const id of users)await api.users.deleteUser(id)
  mkdirSync('test-results/local',{recursive:true,mode:0o700})
  writeFileSync('test-results/local/cutover-checklist.json',JSON.stringify(results,null,2)+'\n',{mode:0o600})
})
test('public reads, legacy 404s and exact monitor exception',async({page,request:raw})=>{
  expect((await raw.get(backend+'/health')).status()).toBe(200)
  expect((await raw.get(backend+'/v1/me')).status()).toBe(401)
  expect((await raw.get(backend+'/v1/watchlist')).status()).toBe(401)
  const index=await raw.get(backend+'/v1/tickers/index');expect(index.status()).toBe(200)
  expect((await index.json()).items.some((item:{symbol:string})=>item.symbol==='ACME')).toBe(true)
  const prices=await raw.get(backend+'/v1/tickers/ACME/ohlc?period_days=365')
  expect(prices.status()).toBe(200);expect((await prices.json()).length).toBeGreaterThan(0)
  for(const path of ['/tickers/index','/signals/history/ACME','/signals/flips','/screener/signals',
    '/network','/relationships/ACME','/site/calendar','/site/watchlist','/site/ai-research/runs',
    '/site/research/synthetic/experiments','/internal/alerts/work','/v1/signals/export'])
    expect((await raw.get(backend+path)).status(),path).toBe(404)
  const monitor=readFileSync(resolve(profile,'.state/secrets/monitor'),'utf8').trim()
  expect((await raw.get(backend+'/analyst/relationship-map/source-health',{headers:{Authorization:'Bearer '+monitor}})).status()).toBe(200)
  expect((await raw.get(backend+'/analyst/relationship-map/source-health',{headers:{Authorization:'Bearer synthetic-other-service-credential'}})).status()).toBe(403)
  expect((await raw.get(backend+'/v1/admin/me',{headers:{Authorization:'Bearer '+monitor}})).status()).toBe(403)
  await page.goto('/stocks/ACME');await expect(page.getByRole('heading',{level:1}).first()).toBeVisible()
  await page.goto('/calendar');await expect(page.getByRole('heading',{level:1})).toBeVisible()
  await page.goto('/markets/network');await expect(page.getByRole('heading',{name:'Sign in to explore relationships'})).toBeVisible()
  await page.goto('/stocks/ACME/signals');await expect(page.getByRole('heading',{name:'Directional signals',exact:true})).toBeVisible()
  results.public_and_retired='PASS';results.me_without_credentials='401';results.monitor_exception='PASS'
})
test('two real Development sessions keep watchlists private and the BFF works',async({page,browser})=>{
  await page.goto('/');await clerk.signIn({page,emailAddress:emails[0]})
  await page.waitForFunction(()=>Boolean((window as unknown as {Clerk?:{session?:unknown}}).Clerk?.session))
  const me=await request(page,'/v1/me');expect(me.status).toBe(200)
  const account=me.body.accounts[0].id as string
  const added=await page.request.post('/api/watchlist',{data:{ticker:'ACME'}});expect(added.status()).toBe(200)
  const own=await request(page,`/v1/watchlist?account_id=${account}`);expect(own.status).toBe(200);expect(own.body.tickers).toContain('ACME')
  const otherContext=await browser.newContext();const other=await otherContext.newPage()
  try{
    await other.goto('/');await clerk.signIn({page:other,emailAddress:emails[1]})
    await other.waitForFunction(()=>Boolean((window as unknown as {Clerk?:{session?:unknown}}).Clerk?.session))
    expect((await request(other,`/v1/watchlist?account_id=${account}`)).status).toBe(404)
    expect((await request(other,'/v1/admin/me')).status).toBe(403)
  }finally{await otherContext.close()}
  const removed=await page.request.delete('/api/watchlist',{data:{ticker:'ACME'}});expect(removed.status()).toBe(200)
  expect((await request(page,`/v1/watchlist?account_id=${account}`)).body.tickers).not.toContain('ACME')
  expect((await page.request.get('/api/export-signals?ticker=ACME')).status()).toBe(404)
  results.watchlist_owner_and_bff='PASS';results.non_admin_denied='PASS'
})
test('backoffice real session, expiring explicit RBAC grant and immediate revocation',async({browser})=>{
  const context=await browser.newContext();const page=await context.newPage()
  let grant:string|undefined
  try{
    await page.goto('http://localhost:3101/sign-in');await clerk.signIn({page,emailAddress:emails[0]})
    await page.waitForFunction(()=>Boolean((window as unknown as {Clerk?:{session?:unknown}}).Clerk?.session))
    expect((await page.request.get('http://localhost:3101/api/sidebar-state')).status()).toBe(403)
    const permissions=JSON.parse(readFileSync(resolve(repos,'finance-infra/docs/eng196/primeiro-admin-permissoes.json'),'utf8'))
    const entries:string[]=Array.isArray(permissions)?permissions:permissions.permissions
    const role='qa-cutover-'+run
    await admin('role','--role',role,...entries.flatMap(value=>['--permission',value]),'--reason','Synthetic full-cutover rehearsal')
    const issuer=JSON.parse(readFileSync(resolve(profile,'.state/secrets/clerk'),'utf8')).CLERK_JWT_ISSUER
    const granted=await admin('grant','--role',role,'--issuer',issuer,'--subject',users[0],
      '--valid-until',new Date(Date.now()+3600_000).toISOString(),'--reason','Expiring synthetic cutover grant')
    grant=granted.stdout.match(/Administrative grant ID: ([0-9a-f-]{36})/)?.[1];expect(grant).toBeTruthy()
    const actor=await request(page,'/v1/admin/me');expect(actor.status).toBe(200)
    expect(actor.body.permissions).toEqual(expect.arrayContaining(['backoffice.access','administration.resource-access']))
    await page.goto('http://localhost:3101/');await expect(page.getByRole('heading',{name:'Operations',exact:true})).toBeVisible()
    expect((await page.request.get('http://localhost:3101/api/sidebar-state')).status()).toBe(200)
    await admin('revoke','--grant-id',grant!,'--reason','Synthetic cutover cleanup');grant=undefined
    expect((await request(page,'/v1/admin/me')).status).toBe(403)
    results.backoffice_rbac_and_revocation='PASS'
  }finally{
    if(grant)await admin('revoke','--grant-id',grant,'--reason','Synthetic failure cleanup')
    await context.close()
  }
})
