import { loadApp } from '../../../lib/app-load'
export async function generateMetadata({ params }) {
  const result = await loadApp((await params).status)
  return { title: result.data.name || 'Unavailable' }
}
export default async function Page({ params }) {
  const result = await loadApp((await params).status)
  return <main>{result.data.name}</main>
}
