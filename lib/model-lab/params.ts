import type { ParamValue } from './contract'
import type { TrackScale, TrackSpec } from './value-track'

/**
 * The settings a test can take, grouped by the part of the engine they change.
 * Changing a model setting trains again; changing a rule or a trading assumption
 * reuses the trained model, which is why the groups are shown apart and why the
 * quote prices them differently. Options are what the product offers; the engine
 * decides what each one means.
 */

export type Layer = 'data' | 'model' | 'signal' | 'backtest'
export type Depth = 'guided' | 'advanced' | 'lab'

type BaseParam = Readonly<{
  id: string
  layer: Layer
  label: string
  hint: string
  depth: Depth
  /** Whether the reader can compare several values of it at once. */
  sweep: boolean
}>

export type NumParam = BaseParam &
  Readonly<{
    kind: 'num'
    unit: '' | '%' | 'days' | 'years' | 'bps'
    presets: readonly number[]
    min: number
    max: number
    step: number
    scale: TrackScale
    /** Where most tests sit, shown as a band on the line. */
    typical: readonly [number, number] | null
    def: readonly number[]
  }>

export type ChoiceParam = BaseParam &
  Readonly<{
    kind: 'choice'
    options: readonly (readonly [string, string])[]
    def: readonly string[]
  }>

export type ParamDef = NumParam | ChoiceParam

export const LAYERS: Readonly<Record<Layer, Readonly<{ name: string; tag: string; sub: string }>>> = {
  data: { name: 'Data', tag: "Uses today's snapshot", sub: 'What the test learns from and is judged on.' },
  model: { name: 'The model', tag: 'Retrains the model', sub: 'Changing these means training again, which is where most of the cost is.' },
  signal: { name: 'When to act', tag: 'Reuses the trained model', sub: 'Turns the model’s predictions into positions. Cheap to change.' },
  backtest: { name: 'Trading assumptions', tag: 'Reuses model and rules', sub: 'How those positions would have been traded. The cheapest to change.' },
}

export const MODEL_OPTIONS = [
  ['logit', 'Logistic regression'],
  ['ridge', 'Ridge regression'],
  ['knn', 'Nearest neighbours'],
  ['svm', 'Support vector machine'],
  ['forest', 'Random forest'],
  ['gbm', 'Gradient boosting'],
] as const

function num(
  id: string,
  layer: Layer,
  label: string,
  hint: string,
  depth: Depth,
  sweep: boolean,
  unit: NumParam['unit'],
  presets: readonly number[],
  min: number,
  max: number,
  step: number,
  def: readonly number[],
  scale: TrackScale = 'linear',
  typical: NumParam['typical'] = null
): NumParam {
  return { kind: 'num', id, layer, label, hint, depth, sweep, unit, presets, min, max, step, def, scale, typical }
}

function choice(
  id: string,
  layer: Layer,
  label: string,
  hint: string,
  depth: Depth,
  sweep: boolean,
  options: readonly (readonly [string, string])[],
  def: readonly string[]
): ChoiceParam {
  return { kind: 'choice', id, layer, label, hint, depth, sweep, options, def }
}

export const PARAMS: readonly ParamDef[] = [
  num('history', 'data', 'How much history', 'Years of past data to learn from and be tested on.', 'advanced', false, 'years', [1, 3, 5], 1, 10, 1, [3]),
  num('horizon', 'model', 'Over how long', 'The holding period the idea is judged on.', 'guided', true, 'days', [5, 10, 20], 1, 120, 1, [10], 'log', [5, 20]),
  choice('model', 'model', 'Model', 'The learning method. Simple ones are fast and hard to fool. Richer ones can find more, and overfit more easily.', 'advanced', true, MODEL_OPTIONS, ['gbm']),
  choice('label', 'model', 'What counts as success', 'What the model is trying to predict.', 'guided', true, [['rise', 'Price is higher after the hold'], ['outperform', 'Beats the benchmark'], ['fall-less', 'Falls less than the benchmark'], ['barrier', 'Gains before it loses']], ['outperform']),
  num('gain', 'model', 'Target gain', 'The gain that counts as a success.', 'guided', true, '%', [3, 5, 10], 1, 50, 0.5, [5], 'log', [3, 10]),
  num('loss', 'model', 'Stop-loss', 'The loss that counts as a failure.', 'guided', true, '%', [2, 3, 5], 1, 50, 0.5, [3], 'log', [2, 5]),
  num('train', 'model', 'Learning window', 'How much recent history each period learns from.', 'advanced', true, 'days', [252, 504, 756], 60, 2520, 1, [504], 'log', [252, 756]),
  num('test', 'model', 'Test period length', 'Each separate period the model is judged on.', 'lab', true, 'days', [21, 63, 126], 5, 252, 1, [63], 'log'),
  num('embargo', 'model', 'Gap between learning and testing', 'Days skipped so a label never overlaps the test period.', 'lab', true, 'days', [0, 5, 10], 0, 60, 1, [5], 'sqrt'),
  num('lag', 'model', 'Delay before a signal is usable', 'Every input is delayed so a day never sees itself. Zero is not allowed.', 'lab', false, 'days', [1, 2], 1, 5, 1, [1]),
  num('alpha', 'model', 'Regularisation strength', 'Higher values keep the model simpler.', 'lab', true, '', [0.1, 1, 10], 0.001, 1000, 0.001, [1], 'log'),
  num('trees', 'model', 'Number of trees', 'For forests and gradient boosting.', 'lab', true, '', [100, 300, 600], 10, 2000, 1, [300], 'log'),
  choice('calib', 'model', 'Calibrate probabilities', 'Makes “60% sure” mean about 60%.', 'lab', false, [['none', 'No'], ['sigmoid', 'Sigmoid'], ['isotonic', 'Isotonic']], ['none']),
  choice('regime', 'signal', 'Only act when', 'Limits the idea to certain market conditions.', 'guided', true, [['any', 'In any conditions'], ['falling', 'When the market is falling'], ['rising', 'When the market is rising'], ['pullback', 'After a pullback'], ['calm', 'In calm markets'], ['volatile', 'When volatility is high']], ['any']),
  num('conf', 'signal', 'How sure before acting', 'The model must be at least this sure that the price will rise.', 'advanced', true, '%', [50, 55, 60], 50, 95, 1, [55], 'linear', [50, 65]),
  num('exitgap', 'signal', 'Stay in until confidence falls below', 'A lower exit than entry stops constant flipping.', 'advanced', true, '%', [45, 50, 55], 40, 90, 1, [50]),
  num('smooth', 'signal', 'Smooth the signal over', 'Averages recent predictions so one noisy day does not trigger a trade.', 'advanced', true, 'days', [1, 3, 5, 10], 1, 60, 1, [5], 'log', [3, 10]),
  num('minhold', 'signal', 'Minimum days to hold', 'After buying, hold at least this long.', 'advanced', true, 'days', [0, 3, 5, 10], 0, 60, 1, [0], 'sqrt', [0, 10]),
  num('cool', 'signal', 'Cool-off after selling', 'Days to wait before buying the same stock again.', 'lab', true, 'days', [0, 2, 5], 0, 30, 1, [0], 'sqrt'),
  choice('decay', 'signal', 'If the model is fading', 'Uses the engine’s decay report on the model.', 'advanced', true, [['ignore', 'Ignore it'], ['reduce', 'Halve the position'], ['suppress', 'Stand aside']], ['ignore']),
  choice('sizing', 'signal', 'Position size', 'Fixed, or larger when the model is more sure.', 'advanced', false, [['constant', 'Fixed'], ['conviction', 'Scale with confidence']], ['constant']),
  num('maxexp', 'signal', 'Maximum invested', 'Cap on how much of the portfolio can be in positions.', 'advanced', true, '%', [50, 100], 10, 100, 1, [100]),
  num('cost', 'backtest', 'Trading cost', 'Charged whenever a position changes. 1 bps is 0.01%.', 'advanced', true, 'bps', [1, 5, 10], 0, 100, 0.5, [5], 'sqrt', [1, 10]),
  num('slip', 'backtest', 'Slippage', 'The price moving against you while you trade.', 'advanced', true, 'bps', [0, 2, 5], 0, 100, 0.5, [2], 'sqrt', [0, 5]),
  choice('exec', 'backtest', 'When trades happen', 'Trading at the same close the signal used is optimistic.', 'advanced', true, [['signal_close', 'Same close'], ['next_close', 'Next close'], ['next_open', 'Next open']], ['next_close']),
  choice('bench', 'backtest', 'Benchmark', 'What the thesis has to beat.', 'guided', true, [['market', 'The market'], ['big-tech', 'Big tech'], ['total-market', 'The total market'], ['small-caps', 'Small caps'], ['peers', 'The rest of my list'], ['cash', 'Cash']], ['market']),
  choice('pmode', 'backtest', 'How stocks share the portfolio', 'Follow the signal sizes, or split equally across active names.', 'lab', true, [['target', 'Follow signal sizes'], ['equal', 'Equal weight']], ['target']),
  choice('cash', 'backtest', 'If cash runs short', 'What the simulation does when positions need more cash than exists.', 'lab', false, [['scale', 'Scale positions down'], ['reject', 'Fail the test'], ['margin', 'Allow margin']], ['scale']),
]

export const PARAM_IDS: readonly string[] = PARAMS.map((p) => p.id)

export function paramById(id: string): ParamDef {
  const found = PARAMS.find((p) => p.id === id)
  if (!found) throw new Error(`Unknown parameter: ${id}`)
  return found
}

export type ParamValues = Readonly<Record<string, readonly ParamValue[]>>

export function defaultValues(): Record<string, ParamValue[]> {
  const out: Record<string, ParamValue[]> = {}
  for (const p of PARAMS) out[p.id] = [...p.def]
  return out
}

export function formatParam(id: string, value: ParamValue): string {
  const p = paramById(id)
  if (p.kind === 'choice') return p.options.find((o) => o[0] === value)?.[1] ?? String(value)
  const n = Number(value)
  if (p.unit === '%') return `${n}%`
  if (p.unit === 'days') return `${n} ${n === 1 ? 'day' : 'days'}`
  if (p.unit === 'bps') return `${n} bps`
  if (p.unit === 'years') return `${n} ${n === 1 ? 'year' : 'years'}`
  return String(n)
}

export function trackSpecOf(p: NumParam): TrackSpec {
  return { min: p.min, max: p.max, step: p.step, scale: p.scale, presets: p.presets }
}

const DEPTH_ORDER: Readonly<Record<Depth, number>> = { guided: 0, advanced: 1, lab: 2 }

/** Whether a setting is shown at the reader's depth, and applies to what they chose. */
export function isParamShown(p: ParamDef, depth: Depth, values: ParamValues): boolean {
  if ((p.id === 'gain' || p.id === 'loss') && !(values.label ?? []).includes('barrier')) return false
  return DEPTH_ORDER[p.depth] <= DEPTH_ORDER[depth]
}

export function shownParams(layer: Layer, depth: Depth, values: ParamValues): ParamDef[] {
  return PARAMS.filter((p) => p.layer === layer && isParamShown(p, depth, values))
}

/** Settings with more than one value: the dimensions of a set of tests. */
export function comparedParams(values: ParamValues): string[] {
  return PARAMS.filter((p) => (values[p.id] ?? []).length > 1).map((p) => p.id)
}

export function isSetOfTests(values: ParamValues): boolean {
  return comparedParams(values).length > 0
}

export function countCombinations(values: ParamValues): number {
  let count = 1
  for (const p of PARAMS) {
    if ((p.id === 'gain' || p.id === 'loss') && !(values.label ?? []).includes('barrier')) continue
    count *= Math.max(1, (values[p.id] ?? []).length)
  }
  return count
}

export const FAMILIES = ['Momentum', 'Quality', 'Value', 'Volatility', 'Liquidity', 'Growth'] as const
