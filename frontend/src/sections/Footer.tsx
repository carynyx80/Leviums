import { TREASURY } from '../lib/api'
import { bscAddr } from '../lib/utils'
import { Logo } from '../components/Logo'
import { CopyButton } from '../components/CopyButton'
import { Reveal } from '../components/Reveal'
import { IconArrow } from '../components/Icons'

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <Reveal>
          <div className="cta-band">
            <div className="orb orb-pink small" style={{ left: '-5%', top: '-40%' }} />
            <div className="orb orb-lime small" style={{ right: '-5%', bottom: '-50%' }} />
            <h2 className="h2">Stop trusting. <span className="grad-text">Start verifying.</span></h2>
            <a href="#playground" className="btn btn-primary btn-lg">Get your first receipt <IconArrow width={18} height={18} /></a>
          </div>
        </Reveal>
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo />
            <p className="muted">AI with a receipt. Verifiable AI on BNB Chain.</p>
            <span className="built-on"><span className="bnb-dot" /> Built on BNB Chain</span>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#how">How it works</a>
            <a href="#playground">Playground</a>
            <a href="#explorer">Explorer</a>
            <a href="#tiers">Trust tiers</a>
          </div>
          <div className="footer-col">
            <h4>Developers</h4>
            <a href="#developers">API</a>
            <a href="#faq">FAQ</a>
            <a href="https://bscscan.com" target="_blank" rel="noreferrer">BscScan</a>
          </div>
          <div className="footer-col treasury">
            <h4>Treasury</h4>
            <div className="treasury-row">
              <a className="mono link" href={bscAddr(TREASURY)} target="_blank" rel="noreferrer">{TREASURY}</a>
              <CopyButton value={TREASURY} />
            </div>
            <span className="muted small">BNB Smart Chain mainnet · chainId 56</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Levium</span>
          <span className="footer-word" aria-hidden="true">levium</span>
        </div>
      </div>
    </footer>
  )
}
