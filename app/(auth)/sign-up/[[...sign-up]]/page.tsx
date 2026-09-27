import { SignUp } from '@clerk/nextjs'
import { authAppearance, authAppearanceWithoutSocial } from '@/lib/clerk-appearance'

export default function SignUpPage() {
  return <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/dashboard" appearance={process.env.VERCEL_ENV === 'production' ? authAppearanceWithoutSocial : authAppearance} />
}
