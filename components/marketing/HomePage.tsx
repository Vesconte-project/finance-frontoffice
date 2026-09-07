import { Sora, JetBrains_Mono, Inter } from 'next/font/google'
import { SiteHeader } from '@/components/marketing/site-chrome'
import HomeBoard, { loadHomeBoardData } from '@/components/marketing/HomeBoard'
import HomeClose from '@/components/marketing/HomeClose'
import HomeIndex from '@/components/marketing/HomeIndex'
import HeroConstellation from '@/components/marketing/HeroConstellation'
import HomeNeighborhood from '@/components/marketing/HomeNeighborhood'
import DockingSearch from '@/components/marketing/DockingSearch'
import { ScrollExperience } from '@/components/motion/ScrollRuntime'

const sora = Sora({ subsets: ['latin'], weight: ['400', '600', '700', '800'], display: 'swap' })
const inter = Inter({ subsets: ['latin'], display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' })

async function Sections() {
  const boardData = await loadHomeBoardData()

  return (
    // `data-field-foreground` marks this as content painted over the fixed
    // constellation. HeroConstellation softens the field while any marked
    // element is over the viewport and sharpens it while none is, so the one
    // stretch of the page where the network is alone is the one where it is
    // in focus. See FIELD_SOFTEN there.
    <div data-field-foreground className="relative z-30 text-content-primary">
      <div className="pt-24 md:pt-28 lg:pt-32">
        <HomeBoard data={boardData} />
        <HomeNeighborhood items={boardData.longTerm.status === 'ok' ? boardData.longTerm.items.slice(0, 5) : []} />
        <HomeIndex />
      </div>
      <HomeClose />
    </div>
  )
}

export default function MarketingHomePage() {
  return (
    <ScrollExperience profile="narrative">
      <main
        data-theme="light"
        style={{
          ['--font-display' as never]: sora.style.fontFamily,
          ['--font-body' as never]: inter.style.fontFamily,
          ['--font-mono' as never]: mono.style.fontFamily,
          fontFamily: 'var(--font-body)',
        }}
        className="marketing-home relative min-h-screen bg-[var(--page-bg)] text-content-primary"
      >
        <SiteHeader activeHref="/" />
        <DockingSearch />
        <HeroConstellation />
        <Sections />
      </main>
    </ScrollExperience>
  )
}
