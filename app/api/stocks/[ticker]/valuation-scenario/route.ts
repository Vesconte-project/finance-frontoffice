import { NextResponse } from 'next/server'
import { BackendDataError, fetchBackendJson } from '@/lib/backend'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request, { params }: { params: Promise<{ticker: string}> }) {
  const ticker=(await params).ticker.trim().toUpperCase()
  if (!/^[A-Z0-9][A-Z0-9.-]{0,14}$/.test(ticker)) return NextResponse.json({available:false},{status:400})
  const incoming=new URL(request.url).searchParams
  const query=new URLSearchParams()
  const limits: Record<string,[number,number]>={growthPercent:[-50,50],exitPe:[1,100],requiredReturnPercent:[0,50],years:[1,100]}
  for (const [key,[low,high]] of Object.entries(limits)) {
    const raw=incoming.getAll(key)
    const n=raw.length===1&&raw[0].trim()!==''?Number(raw[0]):NaN
    if (!Number.isFinite(n)||n<low||n>high||(key==='years'&&!Number.isInteger(n))) return NextResponse.json({available:false},{status:400})
    query.set(key,String(n))
  }
  try {
    const payload=await fetchBackendJson<unknown>(`/v1/tickers/${encodeURIComponent(ticker)}/valuation-scenario?${query}`,{context:'backend.tickers.valuation-scenario'})
    return NextResponse.json(payload,{headers:{'Cache-Control':'private, no-store'}})
  } catch(error) {
    const status=error instanceof BackendDataError&&[401,403,429].includes(error.status??0)?error.status!:502
    const headers:Record<string,string>={'Cache-Control':'private, no-store'}
    if (error instanceof BackendDataError&&error.retryAfter) headers['Retry-After']=error.retryAfter
    return NextResponse.json({available:false},{status,headers})
  }
}
