'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import SegmentedControl from '@/components/ui/SegmentedControl'
import { setPreferenceCookie } from '@/lib/model-lab/cookies'
import type { Depth } from '@/lib/model-lab/params'

const STANDARD_DEPTHS = ['guided', 'advanced'] as const
const ADMIN_DEPTHS = [...STANDARD_DEPTHS, 'lab'] as const
const DEPTH_DETAILS: Record<Depth, { label: string; title: string }> = {
  guided: { label: 'Guided', title: 'The sentence and the essentials' },
  advanced: { label: 'Advanced', title: 'Every rule and trading assumption' },
  lab: { label: 'Lab', title: 'The full engine, for admins' },
}

export default function DepthSwitch({ depth, lab }: { depth: Depth; lab: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  function choose(next: Depth) {
    if (next === depth) return
    setPreferenceCookie('model_lab_depth', next)
    start(() => router.refresh())
  }

  return (
    <SegmentedControl
      options={lab ? ADMIN_DEPTHS : STANDARD_DEPTHS}
      optionDetails={DEPTH_DETAILS}
      value={depth}
      onChange={choose}
      ariaLabel="How much detail"
      className={pending ? 'opacity-70' : undefined}
    />
  )
}
