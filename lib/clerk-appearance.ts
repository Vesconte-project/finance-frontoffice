import type { NextClerkProviderProps } from '@clerk/nextjs/types'

export const clerkAppearance = {
  variables: {
    colorBackground: 'var(--glass-bg)',
    colorBorder: 'var(--glass-border)',
    colorForeground: 'var(--color-text-primary)',
    colorMutedForeground: 'var(--color-text-secondary)',
    colorPrimary: 'var(--brand-spark)',
    borderRadius: 'var(--radius-2xl)',
  },
  elements: {
    card: {
      backgroundColor: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      color: 'var(--color-text-primary)',
    },
    userButtonPopoverCard: {
      backgroundColor: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      boxShadow: 'var(--glass-shadow)',
      color: 'var(--color-text-primary)',
    },
  },
} satisfies NextClerkProviderProps['appearance']

// The hosted auth routes use the homepage's light palette even when the viewer's
// system preference is dark. Keep this scoped to SignIn/SignUp so account menus
// elsewhere continue to follow their own surrounding surface.
export const authAppearance = {
  options: { elevation: 'flush' },
  variables: {
    colorBackground: '#f3efe6',
    colorForeground: '#142943',
    colorMutedForeground: '#53657b',
    colorPrimary: '#0b8178',
    colorPrimaryForeground: '#ffffff',
    colorNeutral: '#142943',
    colorInput: '#ffffff',
    colorInputForeground: '#142943',
    colorBorder: '#cbd6d4',
    borderRadius: '14px',
    fontFamily: 'var(--font-geist-sans), sans-serif',
  },
  elements: {
    rootBox: { width: '100%', maxWidth: 'none' },
    cardBox: { width: '100%', maxWidth: 'none', backgroundColor: 'transparent', boxShadow: 'none' },
    card: {
      width: '100%',
      maxWidth: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
      color: '#142943',
    },
    footer: { backgroundColor: 'transparent' },
    headerTitle: {
      fontFamily: 'var(--font-auth-display), sans-serif',
      fontSize: '1.75rem',
      letterSpacing: '-0.025em',
    },
  },
} satisfies NextClerkProviderProps['appearance']

// Clerk Production has Google enabled without OAuth credentials. Until that
// connection is switched off in the Clerk Dashboard, keep the broken option
// out of the hosted sign-in and sign-up forms. Development retains Google.
export const authAppearanceWithoutSocial = {
  ...authAppearance,
  elements: {
    ...authAppearance.elements,
    socialButtonsRoot: { display: 'none' },
    dividerRow: { display: 'none' },
  },
} satisfies NextClerkProviderProps['appearance']
