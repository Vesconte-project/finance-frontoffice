import { permanentRedirect } from 'next/navigation'

/** Profile was renamed Business (Spec "Página de ticker — leitura em camadas V1"). */
export default async function LegacyProfilePage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  permanentRedirect(`/stocks/${ticker.toUpperCase()}/business`)
}
