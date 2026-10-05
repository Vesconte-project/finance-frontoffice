'use client'

import { useState } from 'react'
import BeingBuilt, { BeingBuiltBadge } from '@/components/stocks/research/BeingBuilt'
import ResearchChapter from '@/components/stocks/research/ResearchChapter'
import styles from './Valuation.module.css'

const STEPS = [
  { key: 'growth', label: 'Profit growth, next 10 years', references: 'Its last 10 years, what analysts expect and what is already in the price' },
  { key: 'exit', label: 'P/E in 10 years', references: 'Its median, the sector and today' },
] as const

/**
 * What the price assumes: the reader sets two assumptions and sees a value per
 * share against the price. The value comes from a documented backend model
 * (ENG-165); until it does, the steps are in place and say so when used, and
 * no value is computed here.
 */
export default function PriceAssumesChapter({ ticker }: { ticker: string }) {
  const [asked, setAsked] = useState(false)

  return (
    <ResearchChapter
      id="price-assumes"
      label="What the price assumes"
      lead={<BeingBuilt size="inline">The value of a {ticker} share at your assumptions, and how far it is from the price, is being added.</BeingBuilt>}
      aside={(
        <BeingBuilt label="Value per share">
          A grid of the value per share for a range of growth rates and future P/Es, marked above or below the price, is being added.
        </BeingBuilt>
      )}
    >
      <div className={styles.assumptions} data-assumptions="">
        {STEPS.map((step) => (
          <div key={step.key} className={styles.step}>
            <span className={styles.stepLabel} id={`step-${step.key}`}>{step.label}</span>
            <div className={styles.stepper} role="group" aria-labelledby={`step-${step.key}`}>
              <button type="button" className={styles.stepButton} aria-label={`Lower ${step.label.toLowerCase()}`} onClick={() => setAsked(true)}>−</button>
              <BeingBuiltBadge />
              <button type="button" className={styles.stepButton} aria-label={`Raise ${step.label.toLowerCase()}`} onClick={() => setAsked(true)}>+</button>
            </div>
            <span className={styles.stepReferences}>{step.references}: being added.</span>
          </div>
        ))}
      </div>
      <p className={styles.stepMessage} role="status" data-step-message="">
        {asked ? 'Your assumptions can’t be used yet: the value per share is being added, and nothing is calculated in the meantime.' : ''}
      </p>
    </ResearchChapter>
  )
}
