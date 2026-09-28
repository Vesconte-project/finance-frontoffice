import Stat from '@/components/ui/Stat'

type MetricGridItem = {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
}

type MetricGridProps = {
  items: MetricGridItem[]
  columns?: 2 | 3 | 4
}

function columnsClass(columns: MetricGridProps['columns']): string {
  if (columns === 2) return 'grid-cols-1 sm:grid-cols-2'
  if (columns === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
}

export default function MetricGrid({ items, columns = 4 }: MetricGridProps) {
  return (
    <div className={`grid ${columnsClass(columns)} card-gap`}>
      {items.map((item, index) => (
        <Stat
          key={`${item.label}-${index}`}
          label={item.label}
          value={item.value}
          hint={item.hint}
          className={
            index % 2 === 0
              ? 'bg-transparent glow-key'
              : 'sm:translate-y-[2px]'
          }
        />
      ))}
    </div>
  )
}
