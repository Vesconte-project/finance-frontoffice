// Display types only; no directional backend contract exists before ENG-230.
type SignalDirection = 'bullish' | 'neutral' | 'bearish'

export type ScreenerSignal = {
  ticker: string
  name: string | null
  direction: SignalDirection
  conviction: number | null
  signalDate: string | null
  predictionHorizon: number | null
  price: number | null
  changePercent: number | null
}
