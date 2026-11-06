'use client'

import { useEffect, useRef, useState } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ResearchChapter, { ChapterCard, LeadStat } from '@/components/stocks/research/ResearchChapter'
import { parseScenario, scenarioInputs, type Scenario } from '@/lib/earnings-scenario'
import { retryAfterMs } from '@/lib/retry-policy'
import styles from './Valuation.module.css'

const FIELDS = [
  {key:'growthPercent',label:'Annual earnings per share growth',min:-50,max:50,step:1,suffix:'%'},
  {key:'exitPe',label:'Future P/E',min:1,max:100,step:1,suffix:'×'},
  {key:'requiredReturnPercent',label:'Return you require per year',min:0,max:50,step:1,suffix:'%'},
  {key:'years',label:'Years from now',min:1,max:100,step:1,suffix:'years'},
] as const

export default function PriceAssumesChapter({ticker,inputs}:{ticker:string;inputs?:unknown}) {
  const ready=scenarioInputs(inputs,ticker)
  const [values,setValues]=useState<Record<string,string>>({growthPercent:'',exitPe:'',requiredReturnPercent:'',years:''})
  const [result,setResult]=useState<Scenario|null>(null)
  const [loading,setLoading]=useState(false)
  const [failed,setFailed]=useState(false)
  const [asked,setAsked]=useState(false)
  const [retryVersion,setRetryVersion]=useState(0)
  const [retryAt,setRetryAt]=useState(0)
  const retryDeadline=useRef(0)
  useEffect(()=>{
    if(!retryAt)return
    let timer:ReturnType<typeof setTimeout>
    const release=()=>{
      const remaining=retryAt-Date.now()
      if(remaining<=0)setRetryAt(0)
      else timer=setTimeout(release,Math.min(remaining,2_147_483_647))
    }
    timer=setTimeout(release,Math.min(Math.max(0,retryAt-Date.now()),2_147_483_647))
    return()=>clearTimeout(timer)
  },[retryAt])
  const query=new URLSearchParams(values).toString()
  const valid=!!ready&&FIELDS.every(f=>values[f.key].trim()!==''&&Number.isFinite(Number(values[f.key]))&&Number(values[f.key])>=f.min&&Number(values[f.key])<=f.max&&(f.key!=='years'||Number.isInteger(Number(values[f.key]))))
  useEffect(()=>{
    if(!valid)return
    const controller=new AbortController()
    let timer:ReturnType<typeof setTimeout>
    const request=async()=>{
      const remaining=retryDeadline.current-Date.now()
      if(remaining>0){timer=setTimeout(request,Math.min(remaining,2_147_483_647));return}
      try {
        const response=await fetch(`/api/stocks/${encodeURIComponent(ticker)}/valuation-scenario?${query}`,{signal:controller.signal,cache:'no-store'})
        if(!response.ok){
          if(controller.signal.aborted)return
          const delay=retryAfterMs(response.headers.get('Retry-After'))??0
          retryDeadline.current=Date.now()+delay
          setRetryAt(delay>0?retryDeadline.current:0)
          setResult(null);setFailed(true);setLoading(false)
          return
        }
        const payload=parseScenario(await response.json(),ticker)
        if(!controller.signal.aborted){const same=payload&&FIELDS.every(f=>payload.assumptions[f.key]===Number(values[f.key]));setResult(same?payload:null);setFailed(!same);setLoading(false)}
      }catch{if(!controller.signal.aborted){setResult(null);setFailed(true);setLoading(false)}}
    }
    timer=setTimeout(request,250)
    return()=>{clearTimeout(timer);controller.abort()}
  },[ticker,query,valid,values,retryVersion])
  const change=(key:string,value:string)=>{setResult(null);setFailed(false);setLoading(true);setValues(v=>({...v,[key]:value}))}
  const displayedInputs=result?.inputs??ready
  const gridNumber=(value:number)=>new Intl.NumberFormat('en-US',{notation:value<0.001?'scientific':'compact',maximumSignificantDigits:3}).format(value)
  const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:result?.inputs.currency??ready?.currency??'USD',notation:value>0&&value<0.01?'scientific':'compact',maximumSignificantDigits:5}).format(value)
  return <ResearchChapter id="price-assumes" label="What the price assumes"
    lead={result?<LeadStat value={money(result.presentValue)} context={`Scenario value today · ${result.assumptions.years} years · ${(result.differenceFraction*100).toFixed(1)}% versus the reference price`}/>:!ready?<BeingBuilt size="inline">The value of a {ticker} share at your assumptions is being added.</BeingBuilt>:failed?<div className={styles.scenarioPrompt} role="alert"><p>Couldn&apos;t load the scenario, try again.</p><button type="button" className={`${styles.stepButton} ${styles.retryButton}`} disabled={retryAt>0} onClick={()=>{setFailed(false);setLoading(true);setRetryVersion(v=>v+1)}}>Try again</button>{retryAt>0?<p>Please wait before trying again.</p>:null}</div>:<p className={styles.scenarioPrompt}>Choose your growth, future P/E, required return and horizon to see a scenario.</p>}
    aside={result?<ChapterCard title="Value per share" meta={result.inputs.currency}>
      <div className={styles.scenarioGridWrap} role="region" tabIndex={0} aria-label="Scenario sensitivity values"><table className={styles.scenarioGrid} aria-label="Scenario sensitivity: annual growth by future P/E"><thead><tr><th scope="col">Growth</th>{result.exitPeAxis.map(pe=><th scope="col" key={pe}>{pe}×</th>)}</tr></thead><tbody>{result.grid.map((line,i)=><tr key={result.growthAxis[i]}><th scope="row">{result.growthAxis[i]}%</th>{line.map((cell,j)=><td key={result.exitPeAxis[j]} data-tone={cell.differenceFraction===null?undefined:cell.differenceFraction>=0?'up':'down'} title={cell.value===null?undefined:money(cell.value)}>{cell.value===null?<BeingBuiltBadge/>:gridNumber(cell.value)}</td>)}</tr>)}</tbody></table></div>
      <p className={styles.cardNote}>Your horizon and required return apply to every cell.</p>
    </ChapterCard>:ready?<ChapterCard title="Value per share"><p className={styles.cardNote}>Choose the assumptions to fill the sensitivity grid.</p></ChapterCard>:<BeingBuilt label="Value per share">A grid of the value per share for your assumptions is being added.</BeingBuilt>}
  >
    {displayedInputs?<p className={styles.chartNote}>Trailing earnings per share: {money(displayedInputs.eps)} · Yahoo Finance · Captured {displayedInputs.observedAt.slice(0,10)}</p>:null}
    <div className={styles.assumptions} data-assumptions="">{FIELDS.map(f=><div className={styles.step} key={f.key}>
      <label className={styles.stepLabel} htmlFor={`scenario-${f.key}`}>{f.label}</label>
      {ready?<div className={styles.stepper} role="group" aria-label={f.label}>
        <button type="button" className={styles.stepButton} aria-label={`Lower ${f.label.toLowerCase()}`} onClick={()=>change(f.key,String(Math.max(f.min,(values[f.key]===''?0:Number(values[f.key]))-f.step)))}>−</button>
        <input id={`scenario-${f.key}`} className={styles.scenarioInput} type="number" aria-required="true" aria-invalid={values[f.key]!==''&&(!Number.isFinite(Number(values[f.key]))||Number(values[f.key])<f.min||Number(values[f.key])>f.max||(f.key==='years'&&!Number.isInteger(Number(values[f.key]))))} inputMode={f.key==='years'?'numeric':'decimal'} min={f.min} max={f.max} step={f.step} value={values[f.key]} onChange={e=>change(f.key,e.target.value)} aria-describedby={`scenario-unit-${f.key}`}/>
        <span id={`scenario-unit-${f.key}`}>{f.suffix}</span>
        <button type="button" className={styles.stepButton} aria-label={`Raise ${f.label.toLowerCase()}`} onClick={()=>change(f.key,String(Math.min(f.max,Math.max(f.min,(values[f.key]===''?0:Number(values[f.key]))+f.step))))}>+</button>
      </div>:<div className={styles.stepper}><button type="button" className={styles.stepButton} aria-label={`Lower ${f.label.toLowerCase()}`} onClick={()=>setAsked(true)}>−</button><BeingBuiltBadge/><button type="button" className={styles.stepButton} aria-label={`Raise ${f.label.toLowerCase()}`} onClick={()=>setAsked(true)}>+</button></div>}
      {ready?<span className={styles.stepReferences}>{f.min} to {f.max} {f.suffix}</span>:null}
    </div>)}</div>
    <p className={styles.chartNote} data-method-line="">{result?result.methodLine:ready?'Enter your own assumptions; dividends are excluded.':<><BeingBuiltBadge/> The method and scenario values are being added.</>}</p>
    {result?<p className={styles.chartNote}>Price in {result.assumptions.years} years: {money(result.projectedPrice)} · Reference price: {money(result.inputs.price)} on {result.inputs.priceDate}</p>:null}
    <p className={styles.stepMessage} role="status" data-step-message="">{!ready&&asked?'Your assumptions can’t be used yet: the value per share is being added, and nothing is calculated in the meantime.':ready&&loading&&valid?retryAt>0?'Please wait before trying again.':'Calculating your scenario…':''}</p>
  </ResearchChapter>
}
