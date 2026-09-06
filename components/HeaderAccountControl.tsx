'use client'

import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { ChevronDown } from 'lucide-react'

const joinClassName =
  'site-header__join inline-flex items-center justify-center rounded-full bg-brand-spark px-4 font-semibold text-[color:var(--brand-spark-on)] shadow-[0_10px_24px_-8px_var(--brand-spark)] transition duration-200 hover:brightness-[1.08]'

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
  onToggleAccount,
}: {
  accountOpen: boolean
  onToggleAccount: () => void
}) {
  const { isSignedIn } = useAuth()
  const { user } = useUser()

  if (!isSignedIn) {
    return (
      <Link href="/sign-up" className={joinClassName}>
        Join
      </Link>
    )
  }

  const label = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? 'Account'
  const initial = (user?.firstName ?? label).trim().charAt(0).toUpperCase()

  return (
    <button
      type="button"
      aria-expanded={accountOpen}
      aria-haspopup="menu"
      aria-label={`Account menu for ${label}`}
      // Same reason as the other triggers: focusing on mousedown widens the
      // condensed row and moves the button out from under the cursor before
      // mouseup, so the click never lands.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        // `detail` counts clicks, so it is 0 for keyboard activation. A keyboard
        // user keeps focus here; a pointer user must not, because suppressing
        // the mousedown focus above makes the browser treat any focus that lands
        // afterwards as keyboard-driven, so :focus-visible stays lit after the
        // menu closes — and :focus-within also holds the condensed row open.
        if (event.detail > 0) event.currentTarget.blur()
        onToggleAccount()
      }}
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
    </button>
  )
}
