'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { FAQ_ITEMS, faqJoinSuffix, type FaqGroup, type FaqInlineLink, type FaqItem } from '@/lib/faq-content'

export type { FaqGroup, FaqInlineLink, FaqItem }

const DEFAULT_OPEN_SLUG = FAQ_ITEMS[0]?.slug ?? ''
const KNOWN_SLUGS: ReadonlySet<string> = new Set(FAQ_ITEMS.map((item) => item.slug))

/** The location hash, when it names a question, as a plain slug. `''` otherwise. */
function readHashSlug(): string {
  const candidate = window.location.hash.replace(/^#/, '')
  return KNOWN_SLUGS.has(candidate) ? candidate : ''
}

function subscribeToHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export default function FaqAccordion({ groups }: { groups: readonly FaqGroup[] }) {
  /**
   * The hash is an external system, so it is subscribed to rather than copied
   * into state inside an effect. Reading it during render also means a reader
   * arriving on `/faq#export-data` gets that answer open on the first paint
   * instead of watching the first one open and then swap.
   */
  const hashSlug = useSyncExternalStore(subscribeToHash, readHashSlug, () => '')

  /**
   * A click wins over the hash until the hash changes again, which is what
   * `against` records. Without it, opening a different question while the URL
   * still carried an anchor would be overridden on the next render.
   */
  const [manual, setManual] = useState<{ against: string; slug: string } | null>(null)
  const openItem = manual && manual.against === hashSlug ? manual.slug : hashSlug || DEFAULT_OPEN_SLUG

  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())

  /**
   * Anchor navigation moves focus to the trigger, so a reader arriving from a
   * support link lands on the answer rather than at the top of a page where
   * everything but the first item is collapsed. This is a DOM side effect only;
   * which item is open is already derived above.
   */
  useEffect(() => {
    if (!hashSlug) return
    // Let the panel expand before focus scrolls it into view.
    const frame = requestAnimationFrame(() => {
      triggerRefs.current.get(hashSlug)?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [hashSlug])

  return (
    <div className="faq-accordion mt-12 sm:mt-16">
      {groups.map((group, groupIndex) => {
        const groupId = `faq-group-${groupIndex}`
        const itemStartNumber = groups
          .slice(0, groupIndex)
          .reduce((total, currentGroup) => total + currentGroup.items.length, 0)

        return (
          <section key={group.label} className="mb-16 last:mb-0 sm:mb-20" aria-labelledby={groupId}>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-border pt-4">
              <h2
                id={groupId}
                style={{ fontFamily: 'var(--font-display)' }}
                className="text-2xl font-bold tracking-[-0.04em] text-content-primary sm:text-3xl"
              >
                {group.label}
              </h2>
              <p className="basis-full max-w-[36ch] text-sm leading-6 text-content-secondary sm:ml-auto sm:basis-auto sm:text-right">
                {group.description}
              </p>
            </div>

            <div className="border-y border-border">
              {group.items.map((item, itemIndex) => {
                const panelId = `faq-${item.slug}-answer`
                const isOpen = openItem === item.slug

                return (
                  <article
                    key={item.slug}
                    id={item.slug}
                    className={`group border-b border-border last:border-b-0 scroll-mt-28 transition-colors duration-200 ease-out ${
                      isOpen ? 'bg-surface-hover/45' : ''
                    }`}
                  >
                    {/*
                      The trigger is wrapped in a heading so the questions exist for
                      screen-reader heading navigation, per the WAI-ARIA APG accordion
                      pattern. The heading carries no styling of its own; the visual
                      treatment stays on the button and its spans.
                    */}
                    <h3 className="m-0">
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) triggerRefs.current.set(item.slug, node)
                          else triggerRefs.current.delete(item.slug)
                        }}
                        aria-controls={panelId}
                        aria-expanded={isOpen}
                        className="grid min-h-[76px] w-full grid-cols-[2.5rem_minmax(0,1fr)_2.25rem] items-center gap-3 px-3 py-4 text-left transition-[color,background-color] duration-200 ease-out hover:bg-surface-hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-spark sm:min-h-[84px] sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem] sm:gap-5 sm:px-5 sm:py-5"
                        onClick={() => setManual({ against: hashSlug, slug: isOpen ? '' : item.slug })}
                      >
                        <span
                          style={{ fontFamily: 'var(--font-mono)' }}
                          className="text-xs font-semibold tabular-nums tracking-[0.12em] text-brand-spark/75 sm:text-sm"
                          aria-hidden="true"
                        >
                          {String(itemStartNumber + itemIndex + 1).padStart(2, '0')}
                        </span>
                        <span
                          data-faq-question={item.slug}
                          style={{ fontFamily: 'var(--font-display)' }}
                          className="min-w-0 text-[1.05rem] font-semibold leading-6 tracking-[-0.025em] text-content-primary sm:text-xl sm:leading-7"
                        >
                          {item.question}
                        </span>
                        <span
                          className={`grid size-9 place-items-center justify-self-end rounded-full border border-border text-brand-spark transition-[transform,border-color,color,background-color] duration-[240ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:border-brand-spark/45 ${
                            isOpen ? 'rotate-0 bg-brand-spark/8' : '-rotate-90'
                          }`}
                          aria-hidden="true"
                        >
                          <ArrowDown className="size-4" strokeWidth={1.7} />
                        </span>
                      </button>
                    </h3>

                    {/*
                      The panel is deliberately not a landmark: the APG only recommends
                      that role at six panels or fewer, and twenty of them would put
                      twenty landmarks on one page.
                    */}
                    <div
                      id={panelId}
                      aria-hidden={!isOpen}
                      inert={!isOpen}
                      className={`faq-accordion__panel grid transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)] ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <p
                          className={`grid grid-cols-[2.5rem_minmax(0,1fr)_2.25rem] gap-3 px-3 pb-6 text-[0.98rem] leading-7 text-content-secondary transition-[transform,opacity] duration-[280ms] ease-[cubic-bezier(.22,1,.36,1)] sm:grid-cols-[4rem_minmax(0,1fr)_2.5rem] sm:gap-5 sm:px-5 sm:pb-7 sm:text-base sm:leading-8 ${
                            isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                          }`}
                        >
                          <span aria-hidden="true" />
                          <span className="min-w-0 max-w-[68ch]">
                            {item.answer}{' '}
                            {item.link ? (
                              <>
                                <Link
                                  href={item.link.href}
                                  className="group/inline-link inline-flex items-baseline gap-1 font-semibold text-content-primary underline decoration-brand-spark/45 underline-offset-4 transition-[color,text-decoration-color] duration-200 hover:text-brand-spark hover:decoration-brand-spark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-spark"
                                >
                                  {item.link.label}
                                  <ArrowUpRight className="size-3.5 shrink-0 self-center transition-transform duration-200 ease-out group-hover/inline-link:-translate-y-0.5 group-hover/inline-link:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                                </Link>
                                {item.link.suffix ? faqJoinSuffix(item.link.suffix) : null}
                              </>
                            ) : null}
                          </span>
                          <span aria-hidden="true" />
                        </p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
