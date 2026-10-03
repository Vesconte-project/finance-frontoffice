'use client'

import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { ChevronDown } from 'lucide-react'
import HeaderMenuTrigger from '@/components/header-menu/HeaderMenuTrigger'

const joinClassName =
  'site-header__join inline-flex items-center justify-center rounded-md bg-[var(--btn-primary-bg)] px-4 font-medium text-[var(--btn-primary-fg)] transition duration-200'

/**
 * The header's right-hand control.
 *
 * Signed out it is the Join action. Signed in it is a trigger for the header's
 * own account menu — deliberately not Clerk's `UserButton` dropdown, which
 * arrives as a dark purple panel with its own branding and reads as another
 * product's UI dropped onto the page. The menu it opens is the same glass
 * disclosure the other header menus use; see `HeaderBar`.
 */
export default function HeaderAccountControl({
  accountOpen,
  controls,
  onToggleAccount,
}: {
  accountOpen: boolean
  controls: string
  onToggleAccount: (trigger: HTMLButtonElement, viaKeyboard: boolean) => void
}) {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()

  // Clerk resolves after hydration. Rendering Join in the meantime showed a
  // signed-in visitor the wrong control for a beat, then swapped it. Hold a
  // slot the same size instead so the row does not reflow either.
  if (!isLoaded) return <span className="site-header__account-slot" aria-hidden="true" />

  if (!isSignedIn) {
    return (
      <Link
        href="/sign-up"
        data-analytics-id="header_join"
        data-analytics-event="auth_start"
        data-analytics-intent="sign_up"
        className={joinClassName}
      >
        Join
      </Link>
    )
  }

  const label = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'Account'
  const initial = (user?.firstName ?? label).trim().charAt(0).toUpperCase()

  return (
    <HeaderMenuTrigger
      expanded={accountOpen}
      controls={controls}
      label={`Account menu for ${label}`}
      onToggle={onToggleAccount}
      className="site-header__account"
    >
      <span className="site-header__account-avatar" aria-hidden="true">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" width={28} height={28} />
        ) : (
          initial
        )}
      </span>
      <ChevronDown className="site-nav__chev size-3.5" aria-hidden="true" />
    </HeaderMenuTrigger>
  )
}
