'use client'

import ChartContainer from '@/components/charts/ChartContainer'
import NetworkGraphCanvas from '@/components/NetworkGraphCanvas'
import type { NetworkGraph } from '@/lib/network'

type CorrelationNetworkProps = {
  centerTicker: string
  centerName: string | null
  graph: NetworkGraph
}

export default function CorrelationNetwork({
  centerTicker,
  centerName,
  graph,
}: CorrelationNetworkProps) {
  const normalizedCenter = centerTicker.trim().toUpperCase()
  const hasCenterEdges = graph.edges.some((edge) => edge.source === normalizedCenter || edge.target === normalizedCenter)

  if (graph.nodes.length === 0 || graph.edges.length === 0 || !hasCenterEdges) {
    return (
      <div className="rounded-[8px] border border-dashed border-border p-6 text-sm text-content-muted">
        Correlation relationships are not available for this ticker yet.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-[8px] border border-[var(--line)] bg-[var(--surface)] p-4">
        <ChartContainer className="h-[340px]" loadingText="Loading correlation network...">
          {({ width, height }) => (
            <NetworkGraphCanvas
              graph={graph}
              mode="peer"
              centerTicker={normalizedCenter}
              width={width}
              height={height}
            />
          )}
        </ChartContainer>
      </div>

      <p className="text-[11px] text-content-muted">
        {centerName ? `${normalizedCenter}: ${centerName} · ` : null}
        {graph.asOf ? `As of ${graph.asOf} · ` : null}
        Window {graph.window}
      </p>
    </div>
  )
}
