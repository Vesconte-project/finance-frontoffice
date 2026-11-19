import { SiteHeader } from '@/components/marketing/site-chrome'
import HomeMarketStory from '@/components/marketing/HomeMarketStory'
import HeroConstellation from '@/components/marketing/HeroConstellation'
import DockingSearch from '@/components/marketing/DockingSearch'
import { ScrollExperience } from '@/components/motion/ScrollRuntime'

export default function MarketingHomePage() {
  return (
    <ScrollExperience profile="narrative">
      <main className="marketing-home relative min-h-screen bg-[var(--page-bg)] text-content-primary">
        <SiteHeader activeHref="/" />
        <DockingSearch />
        <HeroConstellation />
        <HomeMarketStory />
      </main>
    </ScrollExperience>
  )
}
