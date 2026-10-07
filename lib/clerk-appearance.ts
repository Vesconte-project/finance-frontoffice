import type { NextClerkProviderProps } from '@clerk/nextjs/types'

export const clerkAppearance = {
  variables: {
    colorBackground: 'var(--glass-bg)',
    colorBorder: 'var(--glass-border)',
    colorForeground: 'var(--color-text-primary)',
    colorMutedForeground: 'var(--color-text-secondary)',
    colorPrimary: 'var(--btn-primary-bg)',
    colorPrimaryForeground: 'var(--btn-primary-fg)',
    borderRadius: '6px',
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

export const authAppearance = {
  options: { elevation: 'flush' },
  variables: {
    colorBackground: 'var(--bg)',
    colorForeground: 'var(--text)',
    colorMutedForeground: 'var(--text-muted)',
    colorPrimary: 'var(--btn-primary-bg)',
    colorPrimaryForeground: 'var(--btn-primary-fg)',
    colorNeutral: 'var(--text)',
    colorInput: 'var(--surface)',
    colorInputForeground: 'var(--text)',
    colorBorder: 'var(--line)',
    borderRadius: '6px',
    fontFamily: 'var(--font-body), sans-serif',
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
      color: 'var(--text)',
    },
    footer: { backgroundColor: 'transparent' },
    headerTitle: {
      fontFamily: 'var(--font-display), sans-serif',
      fontSize: '1.75rem',
      letterSpacing: 'normal',
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
