import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ThesisComposer from '@/components/model-lab/ThesisComposer'
import { modelLabComposerEnabled } from '@/lib/model-lab/flags'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Test a thesis',
  robots: { index: false, follow: false },
}

export default function NewThesisPage() {
  if (!modelLabComposerEnabled()) notFound()

  return (
    <div className="container-md section-gap">
      <header className="max-w-3xl">
        <h1 className="text-page-title text-content-primary">Test a thesis</h1>
        <p className="text-body mt-2">
          Complete the sentence. Every underlined phrase is a choice, and a value you want to compare can take several points on its line.
        </p>
      </header>
      <ThesisComposer />
    </div>
  )
}
