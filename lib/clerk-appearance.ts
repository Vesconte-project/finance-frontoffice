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
