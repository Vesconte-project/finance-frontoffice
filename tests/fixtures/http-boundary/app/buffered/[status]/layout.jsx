import { loadApp } from '../../../lib/app-load'
export default async function Layout({ children, params }) {
  const result = await loadApp((await params).status)
  if (result.status !== 200) throw new Error('Required fixture data unavailable')
  return <section><header>{result.data.name}</header>{children}</section>
}
