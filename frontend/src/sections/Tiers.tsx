import { motion } from 'framer-motion'
import { SectionHead } from '../components/Reveal'
import { IconCheck } from '../components/Icons'

const TIERS = [
  { name: 'Attested', status: 'LIVE', live: true, desc: 'A pinned model runs in a Keelcodes node. Every output is hash-committed and signed by the node’s attestation key. Verifiable by anyone, anchorable on BNB mainnet.', points: ['Model fingerprint + I/O hashes', 'EIP-191 signature', 'On-chain anchoring today'] },
  { name: 'Challengeable', status: 'COMING SOON', live: false, desc: 'Deterministic models can be re-executed by anyone. Post a bond, dispute a receipt on-chain, and slash a dishonest node.', points: ['Re-execution by watchers', 'Bonded nodes & slashing', 'BNB Chain dispute contract'] },
  { name: 'Zero-knowledge proof', status: 'COMING SOON', live: false, desc: 'A succinct proof that the exact model produced the exact output — checked by a smart contract, no trusted signer at all.', points: ['zkML circuits', 'On-chain verifier', 'Trustless by math'] },
]

export function Tiers() {
  return (
    <section className="section tiers" id="tiers">
      <div className="container">
        <SectionHead
          center
          eyebrow="Trust tiers"
          title={<>Honest about <span className="grad-text">what’s live.</span></>}
          sub="Keelcodes ships trust in layers. Attested receipts are live on BNB mainnet today; stronger guarantees are on the roadmap."
        />
        <div className="tier-grid">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              className={`tier ${t.live ? 'live' : ''}`}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6 }}
            >
              {t.live && <div className="tier-glow" />}
              <div className="tier-top">
                <span className="tier-n mono">0{i + 1}</span>
                <span className={`pill ${t.live ? 'pill-lime' : 'pill-dim'}`}>{t.live && <span className="live-dot" />}{t.status}</span>
              </div>
              <h3>{t.name}</h3>
              <p>{t.desc}</p>
              <ul>
                {t.points.map((p) => (
                  <li key={p}><IconCheck width={14} height={14} /> {p}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
