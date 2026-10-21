import { ModelLabError, type Draft, type PanelDraft, type Rigor, type WatchSettings } from './contract'
import { FAMILIES, PARAMS, defaultValues, type ParamValues } from './params'
import type { PanelPatch } from './source'
import {
  BENCHMARK_OPTIONS,
  CONDITION_OPTIONS,
  DOES_OPTIONS,
  GAIN_TRACK,
  HORIZON_TRACK,
  LOSS_TRACK,
  UNIVERSE_OPTIONS,
  WHO_OPTIONS,
  type ThesisSentence,
} from './thesis-sentence'
import { TRACK_MAX_VALUES, type TrackSpec } from './value-track'

/**
 * Request bodies are checked here, once, before anything reaches a source. A body
 * that does not fit is `invalid`; the details are never echoed back.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const TICKER = /^[A-Z0-9.^=-]{1,32}$/

function bad(): never {
  throw new ModelLabError('invalid')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function oneOf<T extends string>(value: unknown, options: readonly { key: T }[]): T {
  const found = options.find((o) => o.key === value)
  if (!found) bad()
  return found.key
}

function numbers(value: unknown, spec: TrackSpec): number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > TRACK_MAX_VALUES) bad()
  const out = value.map((v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < spec.min || v > spec.max) bad()
    return v
  })
  if (new Set(out).size !== out.length) bad()
  return out
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') bad()
  return value
}

function bounded(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) bad()
  return value
}

function sentenceOf(value: unknown): ThesisSentence {
  if (!isObject(value)) bad()
  return {
    who: oneOf(value.who, WHO_OPTIONS),
    universe: oneOf(value.universe, UNIVERSE_OPTIONS),
    does: oneOf(value.does, DOES_OPTIONS),
    benchmark: oneOf(value.benchmark, BENCHMARK_OPTIONS),
    condition: oneOf(value.condition, CONDITION_OPTIONS),
    horizons: numbers(value.horizons, HORIZON_TRACK),
    gains: numbers(value.gains, GAIN_TRACK),
    losses: numbers(value.losses, LOSS_TRACK),
  }
}

function assetsOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) bad()
  const out = value.map((t) => {
    if (typeof t !== 'string' || !TICKER.test(t)) bad()
    return t
  })
  if (new Set(out).size !== out.length) bad()
  return out
}

function valuesOf(value: unknown): ParamValues {
  const out: Record<string, (string | number)[]> = defaultValues()
  if (value === undefined) return out
  if (!isObject(value)) bad()
  for (const [id, raw] of Object.entries(value)) {
    const param = PARAMS.find((p) => p.id === id)
    if (!param || !Array.isArray(raw) || raw.length < 1 || raw.length > TRACK_MAX_VALUES || (raw.length > 1 && !param.sweep)) bad()
    const items = raw.map((v) => {
      if (param.kind === 'num') {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < param.min || v > param.max) bad()
        return v
      }
      if (typeof v !== 'string' || !param.options.some((o) => o[0] === v)) bad()
      return v
    })
    if (new Set(items).size !== items.length) bad()
    out[id] = items
  }
  return out
}

export function parseDraft(body: unknown): Draft {
  if (!isObject(body)) bad()
  const sentence = sentenceOf(body.sentence)
  const values = valuesOf(body.values)
  const same = (a: readonly number[], b: readonly (string | number)[]) => a.length === b.length && a.every((x, i) => x === b[i])
  if (!same(sentence.horizons, values.horizon) || !same(sentence.gains, values.gain) || !same(sentence.losses, values.loss)) bad()
  if (!(values.label ?? []).includes(sentence.does) || (values.label ?? []).length !== 1) bad()
  if (!(values.regime ?? []).includes(sentence.condition) || (values.regime ?? []).length !== 1) bad()
  if (!(values.bench ?? []).includes(sentence.benchmark) || (values.bench ?? []).length !== 1) bad()
  const rigor = body.rigor
  if (rigor !== 'quick' && rigor !== 'standard' && rigor !== 'thorough') bad()
  const families = body.families
  if (!Array.isArray(families) || families.some((f) => !(FAMILIES as readonly unknown[]).includes(f))) bad()
  const d = body.diagnostics
  if (!isObject(d)) bad()
  const reuse = body.reuseTestId
  const thesis = body.thesisId
  if (reuse !== null && !(typeof reuse === 'string' && UUID.test(reuse))) bad()
  if (thesis !== null && !(typeof thesis === 'string' && UUID.test(thesis))) bad()
  return {
    sentence,
    assets: assetsOf(body.assets),
    rigor: rigor as Rigor,
    values,
    families: families as string[],
    diagnostics: { scout: bool(d.scout), decay: bool(d.decay), robust: bool(d.robust), lookahead: bool(d.lookahead) },
    reuseTestId: reuse as string | null,
    thesisId: thesis as string | null,
    registerCandidate: bool(body.registerCandidate),
  }
}

export function parseNote(body: unknown): string {
  if (!isObject(body) || typeof body.text !== 'string') bad()
  const text = body.text.trim()
  if (!text || text.length > 4000) bad()
  return text
}

export function parseWatch(body: unknown): WatchSettings {
  if (!isObject(body)) bad()
  const retest = body.retest
  if (retest !== 'weekly' && retest !== 'monthly' && retest !== 'quarterly' && retest !== 'off') bad()
  return { retest, alertOnWeaker: bool(body.alertOnWeaker), alertOnBetter: bool(body.alertOnBetter), email: bool(body.email), inApp: bool(body.inApp) }
}

function runIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6 || value.some((v) => typeof v !== 'string' || !UUID.test(v))) bad()
  return value as string[]
}

function rule(value: unknown): 'agree' | 'spec' | 'blend' {
  if (value !== 'agree' && value !== 'spec' && value !== 'blend') bad()
  return value
}

export function parsePanelDraft(body: unknown): PanelDraft {
  if (!isObject(body) || typeof body.name !== 'string' || body.name.length > 80) bad()
  return { name: body.name, memberRunIds: runIds(body.memberRunIds), rule: rule(body.rule), agreementNeeded: bounded(body.agreementNeeded, 1, 6), assets: assetsOf(body.assets ?? []) }
}

export function parsePanelPatch(body: unknown): PanelPatch {
  if (!isObject(body)) bad()
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.length > 80) bad()
    patch.name = body.name
  }
  if (body.memberRunIds !== undefined) patch.memberRunIds = runIds(body.memberRunIds)
  if (body.rule !== undefined) patch.rule = rule(body.rule)
  if (body.agreementNeeded !== undefined) patch.agreementNeeded = bounded(body.agreementNeeded, 1, 6)
  if (body.below !== undefined) {
    if (body.below !== 'flat' && body.below !== 'half') bad()
    patch.below = body.below
  }
  if (body.holdDays !== undefined) patch.holdDays = bounded(body.holdDays, 1, 20)
  if (body.quietDays !== undefined) patch.quietDays = bounded(body.quietDays, 0, 30)
  if (body.weeklyCap !== undefined) patch.weeklyCap = bounded(body.weeklyCap, 1, 20)
  if (body.alerts !== undefined) {
    if (!isObject(body.alerts)) bad()
    const keys = ['reached', 'flip', 'collapse', 'spec', 'blind']
    const alerts: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(body.alerts)) {
      if (!keys.includes(k)) bad()
      alerts[k] = bool(v)
    }
    patch.alerts = alerts
  }
  if (body.channels !== undefined) {
    if (!Array.isArray(body.channels) || body.channels.some((c) => c !== 'email' && c !== 'push' && c !== 'app')) bad()
    patch.channels = [...new Set(body.channels as string[])]
  }
  return patch as PanelPatch
}

export function parseAlertsRead(body: unknown): readonly string[] | 'all' {
  if (!isObject(body)) bad()
  if (body.ids === 'all') return 'all'
  if (!Array.isArray(body.ids) || body.ids.length > 200 || body.ids.some((v) => typeof v !== 'string' || !UUID.test(v))) bad()
  return body.ids as string[]
}

export function parseAccessRequest(body: unknown): { experimentId: string; reason: string; expires: '24h' | '7d' } {
  if (!isObject(body) || typeof body.experimentId !== 'string' || typeof body.reason !== 'string') bad()
  if (body.expires !== '24h' && body.expires !== '7d') bad()
  return { experimentId: body.experimentId, reason: body.reason, expires: body.expires }
}

export function isUuid(value: string): boolean {
  return UUID.test(value)
}
