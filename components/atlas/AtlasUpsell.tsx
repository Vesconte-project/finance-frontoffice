'use client'

import Link from 'next/link'
import { useEffect, useId, useRef } from 'react'
import { PRO_COPY, type ProFeature } from '@/lib/atlas-pro'
import { PLANS_HREF, SIGN_IN_HREF, SIGN_UP_HREF } from './atlas-format'
import styles from './AtlasPro.module.css'

/**
 * What a locked Pro feature does and where to get it (pro-spec §8): non-modal,
 * "See plans" takes focus, "Not now" and Escape close it and return focus to
 * the control that opened it. Signed-out readers also learn they need an account.
 */
export default function AtlasUpsell({ feature, signedIn, onClose }: { feature: ProFeature; signedIn: boolean; onClose: () => void }) {
  const titleId = useId()
  const plans = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    plans.current?.focus()
  }, [feature])
  const [title, text] = PRO_COPY[feature]
  return (
    <div className={styles.upsell} role="dialog" aria-modal="false" aria-labelledby={titleId} data-lenis-prevent="">
      <p className={styles.upsellTag}><span className={styles.proTag}>Pro</span></p>
      <h3 id={titleId}>{title}</h3>
      <p>{text}</p>
      <div className={styles.upsellActions}>
        <Link ref={plans} href={PLANS_HREF} className={styles.primary}>See plans</Link>
        <button type="button" onClick={onClose}>Not now</button>
      </div>
      {signedIn ? null : (
        <p className={styles.upsellAnon}>
          Pro tools need an account. <Link href={SIGN_UP_HREF}>Create free account</Link> · <Link href={SIGN_IN_HREF}>Sign in</Link>
        </p>
      )}
    </div>
  )
}
