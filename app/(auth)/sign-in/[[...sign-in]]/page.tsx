import { SignIn } from '@clerk/nextjs'
import { authAppearance } from '@/lib/clerk-appearance'

export default function SignInPage() {
  return <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" appearance={authAppearance} />
}
