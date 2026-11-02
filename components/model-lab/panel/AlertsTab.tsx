'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import { buttonClass } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { AlertReplay, PanelAlertKey, PanelAlerts, PanelSummary } from '@/lib/model-lab/contract'
import { describeError, labFetch } from '@/lib/model-lab/client'
import { Section } from '../ui'

const ALERTS: readonly (readonly [PanelAlertKey, string, string])[] = [
  ['reached', 'Agreement reached', 'A stock gets the agreement the rule asks for.'],
  ['flip', 'A stock flips', 'A flagged stock stops being flagged, or the other way round.'],
  ['collapse', 'Agreement collapses', 'Agreement falls a lot in a single day.'],
  ['spec', 'The specialists change', 'The models with a good record in today’s conditions change.'],
  ['blind', 'Conditions nobody covers', 'Conditions arrive that none of the models has a good record in.'],
]
const CHANNELS = [['app', 'In the app'], ['email', 'Email'], ['push', 'Push']] as const

function ReplayStrip({ replay }: { replay: AlertReplay }) {
  const W = 360
  const H = 56
  const min = Math.min(...replay.market)
  const max = Math.max(...replay.market)
  const x = (i: number) => (i / Math.max(1, replay.market.length - 1)) * W
  const y = (v: number) => 4 + (1 - (v - min) / Math.max(1e-9, max - min)) * (H - 8)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${replay.events.length} alerts over this period`} className="block h-14 w-full">
      <path d={replay.market.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      {replay.events.map((e, i) => <circle key={i} cx={x(e.index)} cy={y(replay.market[e.index] ?? min)} r="3" fill="var(--accent)" />)}
    </svg>
  )
}

export default function AlertsTab({ panel, replays }: { panel: PanelSummary; replays: PanelAlerts['replays'] }) {
  const [alerts, setAlerts] = useState(panel.alerts)
  const [channels, setChannels] = useState<readonly string[]>(panel.channels)
  const [quiet, setQuiet] = useState(panel.quietDays)
  const [cap, setCap] = useState(panel.weeklyCap)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function save() {
    setState('saving')
    try {
      await labFetch<PanelSummary>(`panels/${panel.id}`, { method: 'PATCH', body: { alerts, channels, quietDays: quiet, weeklyCap: cap } })
      setState('saved')
    } catch (error) {
      setMessage(describeError(error))
      setState('error')
    }
  }

  const touch = () => setState('idle')

  return (
    <div className="space-y-8">
      <Section title="What to alert you about" aside="Each is shown on the past year, so you can see how often it would have fired">
        <ul className="space-y-3">
          {ALERTS.map(([key, name, hint]) => {
            const replay = replays.find((r) => r.key === key)
            return (
              <li key={key}>
                <Card padding="md">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={alerts[key]} onChange={(e) => { setAlerts({ ...alerts, [key]: e.target.checked }); touch() }} className="mt-1 h-4 w-4 cursor-pointer accent-[var(--accent)]" />
                    <span><span className="block text-card-title text-content-primary">{name}</span><span className="text-body-sm text-content-muted">{hint}</span></span>
                  </label>
                  {replay ? (
                    <div className="mt-2">
                      <ReplayStrip replay={replay} />
                      <p className="text-caption text-content-muted">About {replay.perMonth.toFixed(1)} a month{replay.droppedByCap > 0 ? `, and ${replay.droppedByCap} would be held back by your weekly limit` : ''}.</p>
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="Limits and delivery">
        <Card padding="md" className="space-y-4">
          <label className="flex items-center gap-3 text-body-sm text-content-primary">Stay quiet for
            <input type="number" min={0} max={30} value={quiet} onChange={(e) => { setQuiet(Math.max(0, Math.min(30, Number(e.target.value) || 0))); touch() }} className="h-11 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2" /> days after an alert about the same stock
          </label>
          <label className="flex items-center gap-3 text-body-sm text-content-primary">At most
            <input type="number" min={1} max={20} value={cap} onChange={(e) => { setCap(Math.max(1, Math.min(20, Number(e.target.value) || 1))); touch() }} className="h-11 w-20 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2" /> alerts a week
          </label>
          <fieldset>
            <legend className="text-body-sm text-content-primary">Send them</legend>
            <div className="mt-1 flex flex-wrap gap-4">
              {CHANNELS.map(([key, label]) => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 text-body-sm text-content-primary">
                  <input type="checkbox" checked={channels.includes(key)} onChange={(e) => { setChannels(e.target.checked ? [...channels, key] : channels.filter((c) => c !== key)); touch() }} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={state === 'saving'} className={cn(buttonClass({ size: 'sm' }), 'disabled:opacity-50')}>{state === 'saving' ? 'Saving…' : 'Save alerts'}</button>
            {state === 'saved' ? <span role="status" className="text-body-sm text-content-muted">Saved.</span> : null}
            {state === 'error' ? <span role="alert" className="text-body-sm text-content-primary">{message}</span> : null}
          </div>
        </Card>
      </Section>
    </div>
  )
}
