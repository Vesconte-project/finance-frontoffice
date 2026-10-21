import Composer, { type ComposerInitial } from '@/components/model-lab/Composer'
import Problem from '@/components/model-lab/Problem'
import { labContext, load } from '@/lib/model-lab/context'
import { ModelLabError } from '@/lib/model-lab/contract'
import { ideaByKey } from '@/lib/model-lab/ideas'
import { DEFAULT_SENTENCE } from '@/lib/model-lab/thesis-sentence'
import { isUuid } from '@/lib/model-lab/validate'

export const dynamic = 'force-dynamic'

type Search = { idea?: string; thesis?: string; reuse?: string; edit?: string }

const BACK = { href: '/models', label: 'All theses' } as const

export default async function NewTestPage({ searchParams }: { searchParams: Promise<Search> }) {
  const query = await searchParams
  const { source, depth, viewer } = await labContext()

  let initial: ComposerInitial = {
    sentence: ideaByKey(query.idea)?.sentence ?? DEFAULT_SENTENCE,
    assets: [],
    thesisId: null,
    reuse: null,
    mode: 'new',
  }

  let thesisId = query.thesis
  if (query.reuse !== undefined) {
    if (!isUuid(query.reuse)) return <Problem error={new ModelLabError('not-found')} back={BACK} />
    const results = await load(() => source.getTestResults(query.reuse!))
    if (!results.ok) return <Problem error={results.error} back={BACK} />
    thesisId = results.data.thesisId
    initial = { ...initial, reuse: { testId: query.reuse } }
  }

  if (thesisId !== undefined) {
    if (!isUuid(thesisId)) return <Problem error={new ModelLabError('not-found')} back={BACK} />
    const detail = await load(() => source.getThesis(thesisId!))
    if (!detail.ok) return <Problem error={detail.error} back={BACK} />
    const { sentence, assets } = detail.data.summary
    initial = { ...initial, sentence, assets, thesisId, mode: query.edit === '1' ? 'edit' : 'again' }
  }

  return <Composer initial={initial} depth={depth} isTeam={viewer.role === 'team'} />
}
