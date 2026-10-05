'use client'

import { useState, type FormEvent } from 'react'
import styles from './AskQuestion.module.css'

const SUGGESTIONS = [
  'What should I investigate next?',
  'What is changing in the recent signal?',
  'What are the main business risks?',
]

/**
 * The question box for AI research on a ticker. Answers are being built
 * (ENG-162), so asking — typed or suggested — answers with an explicit message
 * instead of sitting disabled (Spec: interactions without a backend never stay
 * silent). Nothing is sent anywhere.
 */
export default function AskQuestion({ ticker }: { ticker: string }) {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState(false)

  const ask = (event?: FormEvent) => {
    event?.preventDefault()
    setAsked(true)
  }

  return (
    <div className={styles.ask} data-ask-question="">
      <form className={styles.row} onSubmit={ask}>
        <label className="sr-only" htmlFor="ai-question">Your question about {ticker}</label>
        <input
          id="ai-question"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={`Ask about ${ticker}`}
          autoComplete="off"
        />
        <button type="submit">Ask</button>
      </form>
      <div className={styles.suggestions} role="group" aria-label="Suggested questions">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setQuestion(suggestion)
              ask()
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      <p className={styles.message} role="status" data-ask-message="">
        {asked ? `Answers about ${ticker} can’t be given yet: AI research, with citations to the data it uses, is being added. Nothing was sent.` : ''}
      </p>
    </div>
  )
}
