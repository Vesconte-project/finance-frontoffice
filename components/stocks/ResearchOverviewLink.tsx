import Link from 'next/link'

export default function ResearchOverviewLink({ ticker }: { ticker: string }) {
  return <Link prefetch={false} href={`/stocks/${ticker}`} className="action-link inline-flex">Back to overview →</Link>
}
