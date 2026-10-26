import { loadRequired } from '../../lib/load'
export async function getServerSideProps({ req, res, params }) {
  const incoming = new Headers()
  for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') incoming.set(key, value)
  const result = await loadRequired(params.status, incoming)
  res.setHeader('Cache-Control', 'private, no-store')
  if ([429, 503].includes(result.status)) {
    res.statusCode = result.status
    res.setHeader('Retry-After', result.retryAfter || '60')
    return { props: { unavailable: true } }
  }
  if (result.status !== 200) { res.statusCode = 502; return { props: { unavailable: true } } }
  // Optional request is behind the mandatory boundary, and never changes it.
  const optional = await fetch(`${process.env.FIXTURE_BACKEND}/optional`, { headers: { 'x-fixture-case': incoming.get('x-fixture-case') } })
  return { props: { name: result.data.name, optionalAvailable: optional.ok } }
}
export default function Page({ name, unavailable, optionalAvailable }) {
  return <main>{unavailable ? 'Temporarily unavailable' : <><header>{name}</header><h1>{name}</h1><p>{optionalAvailable ? 'Optional ready' : 'Optional unavailable'}</p></>}</main>
}
