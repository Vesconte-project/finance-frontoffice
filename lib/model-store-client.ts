'use client'

import { buildModelRecord, type ModelDraftInput, type ModelRecord } from '@/lib/model-builder'
import { buildSampleModelInput, SAMPLE_MODEL_ID } from '@/lib/model-samples'

const STORAGE_KEY = 'vesconte_models_v1'

function parseModels(raw: string | null): ModelRecord[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ModelRecord => Boolean(item && typeof item === 'object' && 'id' in item))
  } catch {
    return []
  }
}

function buildSeedSampleModel(): ModelRecord {
  return buildModelRecord(buildSampleModelInput(), {
    id: SAMPLE_MODEL_ID,
    createdAt: '2026-01-05T00:00:00.000Z',
    status: 'validated',
  })
}

export function loadModelsFromStorage(): ModelRecord[] {
  if (typeof window === 'undefined') return []
  let rows: ModelRecord[] = []
  try {
    rows = parseModels(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    rows = []
  }
  if (rows.length === 0) {
    const sample = buildSeedSampleModel()
    saveModelsToStorage([sample])
    return [sample]
  }
  return [...rows].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

export function saveModelsToStorage(models: ModelRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
  } catch {
    // Ignore storage persistence failures and keep in-memory flow functional.
  }
}

export function upsertModel(model: ModelRecord): ModelRecord[] {
  const models = loadModelsFromStorage()
  const index = models.findIndex((row) => row.id === model.id)
  if (index >= 0) models[index] = model
  else models.unshift(model)
  saveModelsToStorage(models)
  return models
}

export function getModelById(id: string): ModelRecord | null {
  const models = loadModelsFromStorage()
  const existing = models.find((row) => row.id === id)
  if (existing) return existing
  if (id !== SAMPLE_MODEL_ID) return null
  const sample = buildSeedSampleModel()
  upsertModel(sample)
  return sample
}

export function saveDraftModel(input: ModelDraftInput): ModelRecord {
  const model = buildModelRecord(input, { status: 'draft' })
  upsertModel(model)
  return model
}

async function requestHistoricalValidation(
  input: ModelDraftInput,
  {
    id,
    createdAt,
  }: {
    id?: string
    createdAt?: string
  } = {}
): Promise<ModelRecord> {
  const response = await fetch('/api/models/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input,
      id,
      createdAt,
    }),
  })
  if (!response.ok) {
    throw new Error(`Validation request failed (${response.status})`)
  }
  const payload = (await response.json()) as { model?: ModelRecord }
  if (!payload.model) {
    throw new Error('Validation response missing model payload')
  }
  return payload.model
}

export async function createValidatedModel(input: ModelDraftInput): Promise<ModelRecord> {
  const model =
    input.universe === 'single-stock' && input.ticker
      ? await requestHistoricalValidation(input)
      : buildModelRecord(input, { status: 'validated' })
  upsertModel(model)
  return model
}

export async function rerunModelValidation(id: string): Promise<ModelRecord | null> {
  const current = getModelById(id)
  if (!current) return null
  const input: ModelDraftInput = {
    name: current.name,
    universe: current.universe,
    ticker: current.ticker,
    lookbackDays: current.lookbackDays,
    benchmark: current.benchmark,
    logicMode: current.logicMode,
    conditions: current.conditions,
    validation: current.validation,
    sourceKind: current.sourceKind,
    templateKey: current.templateKey,
    variationOfModelId: current.variationOfModelId,
    variationLabel: current.variationLabel,
  }

  const rerun =
    input.universe === 'single-stock' && input.ticker
      ? await requestHistoricalValidation(input, {
          id: current.id,
          createdAt: current.createdAt,
        })
      : buildModelRecord(input, {
          id: current.id,
          createdAt: current.createdAt,
          status: 'validated',
        })
  upsertModel(rerun)
  return rerun
}

export function duplicateModelRecord(id: string): ModelRecord | null {
  const current = getModelById(id)
  if (!current) return null
  const now = new Date().toISOString()
  const duplicatedId = `model_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
  const duplicatedConditions = current.conditions.map((condition) => ({
    ...condition,
    id: `cond_${Math.random().toString(36).slice(2, 8)}`,
  }))
  const duplicatedName = `${current.name} (Copy)`

  const duplicated =
    current.status === 'validated'
      ? {
          ...current,
          id: duplicatedId,
          name: duplicatedName,
          conditions: duplicatedConditions,
          createdAt: now,
          updatedAt: now,
          sourceKind: current.sourceKind ?? 'manual',
          templateKey: current.templateKey ?? null,
          variationOfModelId: current.variationOfModelId ?? null,
          variationLabel: current.variationLabel ?? null,
        }
      : buildModelRecord(
          {
            name: duplicatedName,
            universe: current.universe,
            ticker: current.ticker,
            lookbackDays: current.lookbackDays,
            benchmark: current.benchmark,
            logicMode: current.logicMode,
            conditions: duplicatedConditions,
            validation: current.validation,
            sourceKind: current.sourceKind,
            templateKey: current.templateKey,
            variationOfModelId: current.variationOfModelId,
            variationLabel: current.variationLabel,
          },
          { status: current.status }
        )
  upsertModel(duplicated)
  return duplicated
}
