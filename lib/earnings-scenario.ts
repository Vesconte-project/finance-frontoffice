/** Owned backend model; this module validates transport and formats no economics. */
export type ScenarioInput = {
  version: 'earnings_model_inputs.v1'; symbol: string; source: 'yahoo_finance'; currency: string
  eps: number; epsBasis: 'provider_trailing_eps'; observedAt: string; price: number; priceDate: string; priceBasis: 'raw'
}
export type Scenario = {
  available: true; ticker: string; methodologyVersion: 'terminal_earnings_scenario.v1'
  assumptions: { growthPercent: number; exitPe: number; requiredReturnPercent: number; years: number }
  inputs: ScenarioInput; projectedPrice: number; presentValue: number; differenceFraction: number
  growthAxis: number[]; exitPeAxis: number[]; grid: { value: number | null; differenceFraction: number | null }[][]; methodLine: string
}
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : null
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
export function scenarioInputs(value: unknown, ticker: string, now = Date.now()): ScenarioInput | null {
  const r = object(value)
  if (!r || r.symbol !== ticker || r.version !== 'earnings_model_inputs.v1' || r.source !== 'yahoo_finance' || r.epsBasis !== 'provider_trailing_eps' || r.priceBasis !== 'raw') return null
  if (typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency) || ['XXX','GBX','ZAC','ILA'].includes(r.currency) || !positive(r.eps) || !positive(r.price)) return null
  if (typeof r.observedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(r.observedAt) || typeof r.priceDate !== 'string') return null
  const stamp = Date.parse(r.observedAt)
  if (!Number.isFinite(stamp) || stamp > now || new Date(stamp).toISOString().slice(0,10) !== r.priceDate) return null
  const age = Math.floor(now/86400000)-Math.floor(stamp/86400000)
  return age >= 0 && age <= 7 ? r as unknown as ScenarioInput : null
}
export function parseScenario(value: unknown, ticker: string): Scenario | null {
  const r = object(value)
  if (!r || r.available !== true || r.ticker !== ticker || r.methodologyVersion !== 'terminal_earnings_scenario.v1' || !scenarioInputs(r.inputs,ticker)) return null
  if (!positive(r.presentValue) || !positive(r.projectedPrice) || typeof r.differenceFraction !== 'number' || !Number.isFinite(r.differenceFraction) || typeof r.methodLine !== 'string') return null
  const assumptions=object(r.assumptions)
  if (!assumptions || !['growthPercent','exitPe','requiredReturnPercent','years'].every(k=>typeof assumptions[k]==='number' && Number.isFinite(assumptions[k]))) return null
  if (!Array.isArray(r.growthAxis) || !Array.isArray(r.exitPeAxis) || r.growthAxis.length > 5 || r.exitPeAxis.length > 5 || !r.growthAxis.every(x=>typeof x==='number'&&Number.isFinite(x)) || !r.exitPeAxis.every(positive)) return null
  if (!Array.isArray(r.grid) || r.grid.length!==r.growthAxis.length) return null
  const width=r.exitPeAxis.length
  if (!r.grid.every(line=>Array.isArray(line)&&line.length===width&&line.every(cell=>{
    const c=object(cell);return c && (c.value===null||positive(c.value)) && (c.differenceFraction===null||(typeof c.differenceFraction==='number'&&Number.isFinite(c.differenceFraction)))
  }))) return null
  return r as unknown as Scenario
}
