'use client'

import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import { Bell, Bookmark, FlaskConical, MessageSquareShare } from 'lucide-react'

const joinClassName =
  'site-header__join inline-flex items-center justify-center rounded-full bg-brand-spark px-4 font-semibold text-[color:var(--brand-spark-on)] shadow-[0_10px_24px_-8px_var(--brand-spark)] transition duration-200 hover:brightness-[1.08]'

export default function HeaderAccountControl() {
  const { isSignedIn } = useAuth()

  if (!isSignedIn) {
    return (
      <Link href="/sign-up" className={joinClassName}>
        Join
      </Link>
    )
  }

  return (
    <UserButton
      appearance={{
        elements: {
          userButtonAvatarBox: 'site-header__join aspect-square',
        },
      }}
    >
      <UserButton.MenuItems>
        <UserButton.Link
          label="Watchlist"
          href="/dashboard/watchlist"
          labelIcon={<Bookmark className="size-4" aria-hidden="true" />}
        />
        <UserButton.Link
          label="Alerts"
          href="/dashboard/alerts"
          labelIcon={<Bell className="size-4" aria-hidden="true" />}
        />
        <UserButton.Link
          label="Model Lab"
          href="/models"
          labelIcon={<FlaskConical className="size-4" aria-hidden="true" />}
        />
        <UserButton.Link
          label="Community"
          href="/community"
          labelIcon={<MessageSquareShare className="size-4" aria-hidden="true" />}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}
