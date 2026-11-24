import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SectionHead, Reveal } from '../components/Reveal'

const QA = [
  ['What is a Keelcodes receipt?', 'A small JSON object that commits to the model (by fingerprint), your input and the output (by keccak256 hashes), the BNB block it ran against, and a timestamp. All of that is hashed into a receiptHash and signed by the node’s attestation key. If any byte changes, verification fails.'],
  ['Is it really on mainnet?', 'Yes. Keelcodes runs on BNB Smart Chain mainnet (chainId 56) only — no testnet. Models read live mainnet state, and anchoring writes a real transaction you can inspect on BscScan.'],
  ['Is zero-knowledge proving live?', 'Not yet. Today receipts are in the Attested tier: signed by a known node key and verifiable by anyone. Challengeable (re-execution + slashing) and ZK proofs are on the roadmap, and we label them clearly as coming soon.'],
  ['What’s on the roadmap?', 'More models (wallet reputation, credit scoring, AI judges), an on-chain receipt registry contract on BNB Chain, challengeable receipts with bonded nodes, and eventually zkML proofs verified by smart contracts.'],
  ['What does it cost?', 'Asking and verifying are free during launch. Anchoring a receipt on BNB mainnet only costs the network gas for a 0-BNB transaction — typically a cent or less. Keelcodes takes no fee.'],
  ['Can I verify without trusting Keelcodes?', 'Yes. Recompute the hashes, then recover the signer with any Ethereum library (e.g. viem verifyMessage). The Developers section has a copy-paste example.'],
]

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="section faq" id="faq">
      <div className="container faq-grid">
        <SectionHead eyebrow="FAQ" title={<>Questions, <span className="grad-text">answered.</span></>} sub="Still curious? Read the receipt spec in the Developers section or ping us on X." />
        <div className="faq-list">
          {QA.map(([q, a], i) => (
            <Reveal key={q} delay={i * 0.04}>
              <div className={`faq-item ${open === i ? 'open' : ''}`}>
                <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span>{q}</span>
                  <span className="faq-plus" aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div className="faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
                      <p>{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
