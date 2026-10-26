import { loadApp } from '../../../lib/app-load'
export default async function Layout({ children, params }) {
  const { status } = await params
  const promise = loadApp(status)
  return <section><Header value={promise} />{children}</section>
}
async function Header({ value }) { const result = await value; return <header>{result.data.name || 'Unavailable'}</header> }
