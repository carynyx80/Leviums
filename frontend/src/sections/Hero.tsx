import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { IconArrow, IconCheck } from '../components/Icons'

const WORDS: { t: string; cls?: string }[] = [{ t: 'AI' }, { t: 'with' }, { t: 'a' }, { t: 'receipt.', cls: 'grad-text' }]

export function Hero() {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const cardY = useTransform(scrollY, [0, 600], [0, reduce ? 0 : -60])
  const orbY = useTransform(scrollY, [0, 800], [0, reduce ? 0 : 160])

  return (
    <section className="hero" id="top">
      <motion.div className="orb orb-pink" style={{ y: orbY }} />
      <motion.div className="orb orb-lime" style={{ y: orbY }} />
      <div className="container hero-grid">
        <div className="hero-copy">
          <motion.a
            href="#how"
            className="hero-badge"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <span className="pill pill-lime">Live</span>
            Verifiable AI on BNB Chain mainnet
            <IconArrow width={14} height={14} />
          </motion.a>
          <h1 className="h1" aria-label="AI with a receipt.">
            {WORDS.map((w, i) => (
              <span className="word-wrap" key={i} aria-hidden="true">
                <motion.span
                  className={`word ${w.cls ?? ''}`}
                  initial={reduce ? { opacity: 0 } : { y: '110%', rotate: 4, opacity: 0 }}
                  animate={reduce ? { opacity: 1 } : { y: '0%', rotate: 0, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
                >
                  {w.t}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55 }}>
            Every AI answer on BNB Chain comes with cryptographic proof. <span className="hl">No trust required.</span>
          </motion.p>
          <motion.div className="hero-ctas" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.68 }}>
            <a href="#playground" className="btn btn-primary btn-lg">
              Try the Playground <IconArrow width={18} height={18} />
            </a>
            <a href="#how" className="btn btn-ghost btn-lg">How it works</a>
          </motion.div>
          <motion.div className="hero-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.8 }}>
            <span><IconCheck width={14} height={14} /> Signed by attested node</span>
            <span><IconCheck width={14} height={14} /> Verifiable by anyone</span>
            <span><IconCheck width={14} height={14} /> Anchored on chainId 56</span>
          </motion.div>
        </div>
        <motion.div className="hero-visual" style={{ y: cardY }}>
          <ReceiptCard />
        </motion.div>
      </div>
    </section>
  )
}

function ReceiptCard() {
  const reduce = useReducedMotion()
  const rows = [
    ['model', 'rugscan-v1'],
    ['fingerprint', '0x9f3a…c41e'],
    ['input_hash', '0x2b7d…8e01'],
    ['output_hash', '0xe51c…07fa'],
    ['block', '#135,379,494'],
    ['signer', '0x41Ac…D9b2'],
  ]
  return (
    <motion.div
      className="receipt-float"
      initial={{ opacity: 0, y: 40, rotate: -2 }}
      animate={reduce ? { opacity: 1, y: 0, rotate: -2 } : { opacity: 1, y: [0, -14, 0], rotate: [-2, -0.5, -2] }}
      transition={
        reduce
          ? { duration: 0.6 }
          : { opacity: { duration: 0.8, delay: 0.4 }, y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }, rotate: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 } }
      }
    >
      <div className="receipt-glow" />
      <div className="receipt">
        <div className="receipt-top">
          <span className="receipt-title">LEVIUM RECEIPT</span>
          <span className="pill pill-lime">ATTESTED</span>
        </div>
        <div className="receipt-q">
          <span className="muted">Q</span> Is CAKE safe to hold?
        </div>
        <div className="receipt-a">
          <div className="mini-dial">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" stroke="rgba(255,255,255,.08)" strokeWidth="4" fill="none" />
              <motion.circle
                cx="22" cy="22" r="18" stroke="#C8FF2E" strokeWidth="4" fill="none" strokeLinecap="round"
                strokeDasharray={113} initial={{ strokeDashoffset: 113 }} animate={{ strokeDashoffset: 113 * 0.14 }}
                transition={{ duration: 1.6, delay: 0.9, ease: [0.16, 1, 0.3, 1] }} transform="rotate(-90 22 22)"
              />
            </svg>
            <span>86</span>
          </div>
          <div>
            <div className="verdict verdict-safe">SAFE</div>
            <div className="muted small">Deep PancakeSwap liquidity · no proxy</div>
          </div>
        </div>
        <div className="receipt-perf" />
        <dl className="receipt-rows">
          {rows.map(([k, v], i) => (
            <motion.div key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 + i * 0.08 }}>
              <dt>{k}</dt>
              <dd className="mono">{v}</dd>
            </motion.div>
          ))}
        </dl>
        <div className="receipt-sig">
          <span className="mono">sig 0x8c1f4e…a91b1c</span>
          <span className="sig-ok"><IconCheck width={12} height={12} /> valid</span>
        </div>
        <div className="barcode" aria-hidden="true">
          {Array.from({ length: 42 }).map((_, i) => (
            <span key={i} style={{ width: [1, 2, 3, 1, 2][(i * 7) % 5], opacity: 0.35 + ((i * 13) % 7) / 10 }} />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
