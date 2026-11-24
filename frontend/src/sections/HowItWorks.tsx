import { AnimatePresence, motion, useInView, useScroll, useSpring } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SectionHead } from '../components/Reveal'
import { IconAnchor, IconCpu, IconMsg, IconShield, IconSign } from '../components/Icons'

interface Step {
  n: string
  title: string
  body: string
  icon: ReactNode
  tag: string
}

const STEPS: Step[] = [
  { n: '01', title: 'Ask', body: 'Send a question to a Levium model — a token to scan, a wallet to score. Plain HTTPS, no wallet needed.', icon: <IconMsg width={22} height={22} />, tag: 'POST /v1/ask' },
  { n: '02', title: 'AI runs in a sealed node', body: 'A pinned, fingerprinted model executes against live BNB mainnet state. The exact code and config are hashed, so nobody can swap the model behind your back.', icon: <IconCpu width={22} height={22} />, tag: 'model fingerprint' },
  { n: '03', title: 'Receipt is signed', body: 'Model fingerprint + input hash + output hash + block number are committed into one receiptHash and signed by the node’s attestation key (EIP-191).', icon: <IconSign width={22} height={22} />, tag: 'keccak256 · secp256k1' },
  { n: '04', title: 'Verify anywhere', body: 'Anyone can recompute the hashes and recover the signer — in the browser, in a smart contract, or with five lines of viem. No API trust required.', icon: <IconShield width={22} height={22} />, tag: 'verifyMessage()' },
  { n: '05', title: 'Anchor on BNB mainnet', body: 'One 0-BNB transaction writes the receipt id on-chain forever. A timestamped, public, immutable record that the answer existed — and what it was.', icon: <IconAnchor width={22} height={22} />, tag: 'chainId 56' },
]

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 65%', 'end 55%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })

  return (
    <section className="section how" id="how">
      <div className="orb orb-pink small" style={{ top: '20%', left: '-10%' }} />
      <div className="container">
        <SectionHead
          eyebrow="How it works"
          title={<>From question to <span className="grad-text">on-chain proof</span> in five steps.</>}
          sub="Levium turns an opaque AI call into a verifiable artifact. Here’s the full lifecycle of a receipt."
        />
        <div className="how-grid">
          <div className="how-visual-col">
            <div className="how-visual">
              <StepVisual index={active} />
              <div className="how-progress">
                {STEPS.map((s, i) => (
                  <span key={s.n} className={i <= active ? 'on' : ''} />
                ))}
              </div>
            </div>
          </div>
          <div className="how-steps" ref={listRef}>
            <div className="how-line">
              <motion.div className="how-line-fill" style={{ scaleY: fill }} />
            </div>
            {STEPS.map((s, i) => (
              <StepCard key={s.n} step={s} index={i} active={active === i} done={i < active} onActive={setActive} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StepCard({ step, index, active, done, onActive }: { step: Step; index: number; active: boolean; done: boolean; onActive: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' })
  useEffect(() => {
    if (inView) onActive(index)
  }, [inView, index, onActive])
  return (
    <motion.div
      ref={ref}
      className={`how-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="how-node">
        <span>{step.n}</span>
      </div>
      <div className="how-card">
        <div className="how-card-top">
          <span className="how-icon">{step.icon}</span>
          <span className="tag mono">{step.tag}</span>
        </div>
        <h3>{step.title}</h3>
        <p>{step.body}</p>
        <div className="how-inline-visual"><StepVisual index={index} inline /></div>
      </div>
    </motion.div>
  )
}

function StepVisual({ index, inline }: { index: number; inline?: boolean }) {
  const content = [
    <div className="sv sv-ask" key="0">
      <div className="sv-chat me">Is <span className="mono">0x0E09…cE82</span> safe?</div>
      <div className="sv-chat typing"><span /><span /><span /></div>
    </div>,
    <div className="sv sv-node" key="1">
      <div className="sv-box">
        <div className="sv-box-ring" />
        <IconCpu width={34} height={34} />
        <span className="mono">rugscan-v1</span>
      </div>
      <div className="sv-fp mono">fingerprint 0x9f3a…c41e</div>
    </div>,
    <div className="sv sv-sign" key="2">
      {['modelFingerprint', 'inputHash', 'outputHash', 'blockNumber'].map((k, i) => (
        <motion.div key={k} className="sv-hash" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
          <span className="mono">{k}</span>
        </motion.div>
      ))}
      <div className="sv-arrow">↓ keccak256 + sign</div>
      <div className="sv-sig mono">receiptHash 0x7ab2…19fe ✍</div>
    </div>,
    <div className="sv sv-verify" key="3">
      {['Signature recovers trusted signer', 'Input hash matches', 'Output hash matches', 'Receipt hash recomputed'].map((t, i) => (
        <motion.div key={t} className="sv-check" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}>
          <span className="tick">✓</span>{t}
        </motion.div>
      ))}
    </div>,
    <div className="sv sv-anchor" key="4">
      <div className="sv-chain">
        {[0, 1, 2].map((b) => (
          <motion.div key={b} className={`sv-block ${b === 2 ? 'hot' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: b * 0.14 }}>
            <span className="mono">#{(135379492 + b).toLocaleString('en-US')}</span>
            {b === 2 && <span className="mono small">data: 0x7ab2…</span>}
          </motion.div>
        ))}
      </div>
      <div className="sv-fp mono">BNB Smart Chain · mainnet</div>
    </div>,
  ]
  if (inline) return content[index]
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={index}
        className="sv-stage"
        initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16, filter: 'blur(8px)' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="sv-label">
          <span className="mono">{STEPS[index].n}</span> {STEPS[index].title}
        </div>
        {content[index]}
      </motion.div>
    </AnimatePresence>
  )
}
