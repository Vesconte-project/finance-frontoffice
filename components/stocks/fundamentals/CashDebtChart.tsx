import ChartFrame, { ChartPlot, ChartLabel } from '@/components/stocks/research/ChartFrame'
import type { CashDebtPoint } from '@/lib/capital-statements'
import { formatCompactMoney } from '@/lib/currency'
import type { PlotBox } from '@/lib/chart-labels'
import styles from './CashDebtChart.module.css'

function Plot({points,box,variant}:{points:CashDebtPoint[];box:PlotBox;variant:'wide'|'compact'}) {
  const high=Math.max(1,...points.flatMap(point=>[point.cash,point.netCash]))
  const low=Math.min(-1,...points.flatMap(point=>[-point.debt,point.netCash]))
  const y=(amount:number)=>24+(high-amount)/(high-low)*(box.height-56)
  const step=box.width/Math.max(1,points.length)
  const x=(index:number)=>step*(index+.5)
  const width=Math.min(24,step*.23)
  return <ChartPlot box={box} variant={variant} labels={<>
    {points.map((point,index)=><ChartLabel key={point.periodEnd} box={box} x={x(index)} y={box.height-12} tone="muted">{variant==='compact'?`'${String(point.year).slice(-2)}`:point.year}</ChartLabel>)}
    {points.map((point,index)=>index===points.length-1?<ChartLabel key={`net-${point.periodEnd}`} box={box} x={x(index)} anchor="end" y={y(point.netCash)-8} baseline="end" strong>{formatCompactMoney(point.netCash,point.currency)}</ChartLabel>:null)}
  </>}>
    <line className={styles.zero} x1={0} x2={box.width} y1={y(0)} y2={y(0)} />
    {points.map((point,index)=><g key={point.periodEnd}>
      <rect className={styles.cash} x={x(index)-width-1} y={y(point.cash)} width={width} height={Math.max(0,y(0)-y(point.cash))} />
      <rect className={styles.debt} x={x(index)+1} y={y(0)} width={width} height={Math.max(0,y(-point.debt)-y(0))} />
      {index>0 && Date.parse(point.periodEnd)-Date.parse(points[index-1].periodEnd)<=380*86400000?<line className={styles.net} x1={x(index-1)} y1={y(points[index-1].netCash)} x2={x(index)} y2={y(point.netCash)} />:null}
      <circle className={styles.dot} cx={x(index)} cy={y(point.netCash)} r={3} />
    </g>)}
  </ChartPlot>
}

export default function CashDebtChart({points}:{points:CashDebtPoint[]}) {
  return <div>
    <p className={styles.legend}><span>Cash above zero</span><span>Debt below zero</span><strong>Net cash line</strong></p>
    <ChartFrame ariaLabel="Annual cash, debt and net cash" className={styles.frame}>
      <Plot points={points} box={{width:600,height:260}} variant="wide" />
      <Plot points={points} box={{width:320,height:230}} variant="compact" />
    </ChartFrame>
  </div>
}
