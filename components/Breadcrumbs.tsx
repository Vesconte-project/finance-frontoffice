import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 inline-flex rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 dark:border-[var(--line)] dark:bg-[var(--surface)]"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-content-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="transition-colors hover:text-content-primary">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-content-primary' : ''}>{item.label}</span>
              )}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 text-content-muted" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
