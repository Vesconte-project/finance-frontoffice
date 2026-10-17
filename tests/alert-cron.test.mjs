import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(file, imports, env, fetch) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  runInNewContext(code, { exports, process: { env }, fetch, AbortSignal, TextEncoder, TextDecoder, URL, URLSearchParams,
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`); return imports[name] },
  }, { filename: file })
  return exports
}

function setup(options = {}) {
  const env = { SIGNAL_ALERT_CRON_TOKEN: randomUUID(), ALERT_SERVICE_TOKEN: 'vsa_'+randomBytes(32).toString('base64url'),
    BACKEND_BASE_URL: 'https://backend.example.invalid', RESEND_API_KEY: randomUUID(),
    SIGNAL_ALERT_FROM_EMAIL: 'Synthetic <sender@example.invalid>', ...options.env }
  const calls = { backend:0, recipients:0, email:0, delivered:0, confirmations:0, legacy:0 }
  const order = []
  const subscription = randomUUID()
  const reservation = { id:randomUUID(), recipient_subject:'user_fixture123',
    expires_at:new Date(Date.now()+(options.expired ? -60000 : 60000)).toISOString(),
    events:[{ticker:'SYNTH',signalDate:'2026-10-17',fromDirection:'neutral',toDirection:'bullish',conviction:0.8}] }
  const sentKeys = new Set()
  let reserved=false, confirmed=false, workPage=0
  const fetch = async (url, init) => {
    if (url === 'https://api.resend.com/emails') {
      calls.email++; order.push('email')
      const key=init.headers['Idempotency-Key']
      assert.ok(key==='alerts/'+reservation.id)
      if (options.sendFailure && !options.acceptBeforeFailure) return Response.json({error:'Synthetic failure'}, {status:503})
      if (!sentKeys.has(key)) { calls.delivered++; sentKeys.add(key) }
      if (options.sendFailure) return Response.json({error:'Synthetic private provider detail'}, {status:503})
      return Response.json({id:randomUUID()})
    }
    calls.backend++
    assert.ok(init.headers.Authorization==='Bearer '+env.ALERT_SERVICE_TOKEN)
    assert.equal(init.headers['x-backend-shared-secret'], undefined)
    assert.equal(init.cache,'no-store')
    assert.equal(init.redirect,'error')
    const path=new URL(url).pathname
    if (path==='/internal/alerts/pending') {
      order.push('pending')
      if (options.oversized) return Response.json({reservations:[],next_cursor:null,extra:'x'.repeat(70000)})
      return Response.json({reservations:reserved && !confirmed ? [reservation] : [],next_cursor:null})
    }
    if (path==='/internal/alerts/work') {
      order.push('work'); workPage++
      if (options.workFailure) return Response.json({}, {status:503})
      return Response.json({items:reserved || options.noWork ? [] : [{subscription_id:subscription,event:reservation.events[0]}],
        next_cursor:options.paginate && workPage===1 ? subscription : null})
    }
    if (path==='/internal/alerts/reserve') {
      order.push('reserve')
      assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(),['date','subscription_ids'])
      if (options.reservation==='failure') return Response.json({}, {status:503})
      if (options.reservation==='null') return Response.json(null)
      if (options.reservation==='malformed') return Response.json({reservations:[{id:reservation.id}]})
      if (options.reservation==='missing') return Response.json({events:reservation.events})
      if (options.reservation==='empty') return Response.json({reservations:[]})
      reserved=true
      return Response.json({reservations:[reservation]})
    }
    if (path.endsWith('/confirm')) {
      calls.confirmations++; order.push('confirm')
      if (options.confirmFailure) return Response.json({}, {status:503})
      confirmed=true
      return Response.json({ok:true})
    }
    calls.legacy++
    throw new Error('Unexpected backend endpoint')
  }
  const service = load('lib/alert-service.ts', {'server-only':{},'./backend':{
    backendBaseUrl:()=>env.BACKEND_BASE_URL || '',
  }},env,fetch)
  const alerts = load('lib/alerts.ts', {
    '@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async id=>{
      calls.recipients++; order.push('recipient'); assert.ok(reserved)
      return {id,firstName:'Synthetic',emailAddresses:[{emailAddress:'synthetic@example.invalid'}]}
    }}})},
    '@/lib/site-url':{siteBaseUrl:()=> 'https://example.invalid'},
  },env,fetch)
  const handler=load('app/api/cron/check-signals/route.ts',{
    'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    '@/lib/alert-service':service,'@/lib/alerts':alerts,
  },env,fetch)
  return {env,calls,order,options,reservation,get: async (token=env.SIGNAL_ALERT_CRON_TOKEN, query='')=>handler.GET({
    headers:new Headers(token ? {authorization:'Bearer '+token} : {}),
    nextUrl:new URL('https://example.invalid/api/cron/check-signals?date=2026-10-17'+query),
  })}
}

test('absent/empty cron credential refuses even with a refresh credential',async()=>{
  for (const token of [undefined,'','   ']) {
    const fallback=randomUUID()
    const app=setup({env:{SIGNAL_ALERT_CRON_TOKEN:token,MARKET_REFRESH_TOKEN:fallback}})
    assert.equal((await app.get(fallback)).status,401)
    assert.equal(app.calls.backend,0)
  }
})

test('missing/incorrect cron bearer refuses before service access',async()=>{
  const app=setup()
  assert.equal((await app.get('')).status,401)
  assert.equal((await app.get(randomUUID())).status,401)
  assert.equal(app.calls.backend,0)
})

test('missing service identity never falls back to the site secret or cron credential',async()=>{
  const app=setup({env:{ALERT_SERVICE_TOKEN:'',BACKEND_SHARED_SECRET:randomUUID(),BACKEND_SERVICE_TOKEN:randomUUID()}})
  assert.equal((await app.get()).status,503)
  assert.equal(app.calls.backend,0)
  assert.equal(app.calls.email,0)
})

for (const reservation of ['failure','null','malformed','missing']) {
  test(`reservation ${reservation} never reads a recipient or sends email`,async()=>{
    const app=setup({reservation})
    assert.equal((await app.get()).status,503)
    assert.equal(app.calls.recipients,0)
    assert.equal(app.calls.email,0)
    assert.equal(app.calls.confirmations,0)
  })
}

test('empty reservation and expired reservation never send or confirm',async()=>{
  for (const options of [{reservation:'empty'},{expired:true}]) {
    const app=setup(options)
    assert.equal((await app.get()).status,200)
    assert.equal(app.calls.recipients,0)
    assert.equal(app.calls.email,0)
    assert.equal(app.calls.confirmations,0)
  }
})

test('valid service reservation precedes recipient lookup, email and durable confirmation',async()=>{
  const app=setup()
  const response=await app.get()
  assert.equal(response.status,200)
  assert.deepEqual(app.order,['pending','work','reserve','recipient','email','confirm'])
  assert.equal(app.calls.delivered,1)
  assert.equal(app.calls.confirmations,1)
  assert.equal(app.calls.legacy,0)
  assert.equal(response.headers.get('cache-control'),'private, no-store')
  const body=await response.text()
  for (const privateValue of ['synthetic@example.invalid','user_fixture123','SYNTH',app.reservation.id])
    assert.ok(!body.includes(privateValue))
})

test('retry after failure between send and confirmation reuses one provider idempotency key',async()=>{
  const app=setup({confirmFailure:true})
  assert.equal((await app.get()).status,503)
  app.options.confirmFailure=false
  assert.equal((await app.get()).status,200)
  assert.equal(app.calls.email,2)
  assert.equal(app.calls.delivered,1)
  assert.equal(app.calls.confirmations,2)
})

test('ambiguous provider failure resumes the same reservation without another email',async()=>{
  const app=setup({sendFailure:true,acceptBeforeFailure:true})
  assert.equal((await app.get()).status,200)
  assert.equal(app.calls.confirmations,0)
  app.options.sendFailure=false
  assert.equal((await app.get()).status,200)
  assert.equal(app.calls.email,2)
  assert.equal(app.calls.delivered,1)
  assert.equal(app.calls.confirmations,1)
})

test('dry-run and pagination keep provider access closed without a reservation',async()=>{
  const app=setup({paginate:true})
  assert.equal((await app.get(undefined,'&dryRun=1')).status,200)
  assert.equal(app.calls.recipients,0)
  assert.equal(app.calls.email,0)
  assert.equal(app.calls.confirmations,0)
  assert.deepEqual(app.order,['work','work'])
})

test('unavailable work reports only sanitized aggregate failure',async()=>{
  const app=setup({workFailure:true})
  assert.equal((await app.get()).status,503)
  assert.equal(app.calls.email,0)
})


test('oversized service response refuses before recipient lookup or email',async()=>{
  const app=setup({oversized:true})
  assert.equal((await app.get()).status,503)
  assert.equal(app.calls.recipients,0)
  assert.equal(app.calls.email,0)
})
