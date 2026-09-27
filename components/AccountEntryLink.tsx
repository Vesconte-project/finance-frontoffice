'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'

type AccountEntryLinkProps = {
  className: string
  signedOutLabel: string
  signedInLabel: string
  signedInHref?: string
  analyticsId?: string
  trailingIcon?: ReactNode
}

export default function AccountEntryLink({
  className,
  signedOutLabel,
  signedInLabel,
  signedInHref = '/dashboard',
  analyticsId,
  trailingIcon,
}: AccountEntryLinkProps) {
  const { isLoaded, isSignedIn } = useAuth()

  // Offer a neutral route while Clerk resolves. A signed-out visitor is sent
  // to sign-in by the protected destination, without seeing the wrong CTA.
  if (!isLoaded) {
    return (
      <Link href={signedInHref} className={className}>
        {signedInLabel}
        {trailingIcon}
      </Link>
    )
  }

  return (
    <Link
      href={isSignedIn ? signedInHref : '/sign-up'}
      data-analytics-id={analyticsId ? (isSignedIn ? `${analyticsId}_workspace` : analyticsId) : undefined}
      data-analytics-event={isSignedIn ? undefined : 'auth_start'}
      data-analytics-intent={isSignedIn ? undefined : 'sign_up'}
      className={className}
    >
      {isSignedIn ? signedInLabel : signedOutLabel}
      {trailingIcon}
    </Link>
  )
}
