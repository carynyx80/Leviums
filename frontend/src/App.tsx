import { Nav } from './sections/Nav'
import { Hero } from './sections/Hero'
import { Stats } from './sections/Stats'
import { Marquee } from './sections/Marquee'
import { HowItWorks } from './sections/HowItWorks'
import { Playground } from './sections/Playground'
import { Tiers } from './sections/Tiers'
import { Explorer } from './sections/Explorer'
import { Developers } from './sections/Developers'
import { FAQ } from './sections/FAQ'
import { Footer } from './sections/Footer'

export default function App() {
  return (
    <>
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-noise" aria-hidden="true" />
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Marquee />
        <HowItWorks />
        <Playground />
        <Tiers />
        <Explorer />
        <Developers />
        <FAQ />
      </main>
      <Footer />
    </>
  )
}
