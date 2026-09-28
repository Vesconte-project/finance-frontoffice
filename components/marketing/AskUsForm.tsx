'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { CONTACT_EMAIL } from '@/components/marketing/site-config'

const inputClass =
  'w-full rounded-md border border-border bg-[var(--surface)] px-4 py-3 text-base text-content-primary outline-none transition placeholder:text-content-muted focus:border-brand-spark/50 focus:bg-[var(--surface)] focus:ring-2 focus:ring-brand-spark/15'

export default function AskUsForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return

    const subject = 'A question for the lounge'
    const body = `${message.trim()}\n\n— sent from the FAQ page${email.trim() ? `\nReply to: ${email.trim()}` : ''}`
    const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

    window.location.href = href
    setSent(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Your email (so we can reply)"
        autoComplete="email"
        className={inputClass}
      />
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Ask us anything — about the signal, the system, or the week ahead."
        rows={4}
        required
        className={`${inputClass} resize-none`}
      />
      <button
        type="submit"
        className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[var(--btn-primary-bg)] px-6 font-medium text-[var(--btn-primary-fg)] transition duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
      >
        {sent ? 'Opening your mail app…' : 'Send it our way'}
        <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
      <p className="text-center text-xs text-content-muted">
        A human reads every message. We usually reply within a day.
      </p>
    </form>
  )
}
