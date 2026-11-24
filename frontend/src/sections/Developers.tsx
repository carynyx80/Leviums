import { useState } from 'react'
import { motion } from 'framer-motion'
import { API_URL } from '../lib/api'
import { SectionHead, Reveal } from '../components/Reveal'
import { CopyButton } from '../components/CopyButton'

const SNIPPETS: { id: string; label: string; file: string; code: string }[] = [
  {
    id: 'ask',
    label: 'Ask',
    file: 'ask.js',
    code: `const API = '${API_URL}'

const receipt = await fetch(\`\${API}/v1/ask\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'rugscan-v1',
    input: { token: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
  }),
}).then((r) => r.json())

console.log(receipt.output.verdict, receipt.output.score)
console.log('receipt id:', receipt.id)`,
  },
  {
    id: 'verify',
    label: 'Verify (viem)',
    file: 'verify.js',
    code: `import { verifyMessage, keccak256, encodeAbiParameters } from 'viem'

// 1. Recompute the receipt hash from its parts
const receiptHash = keccak256(encodeAbiParameters(
  [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' },
   { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  [receipt.modelFingerprint, receipt.inputHash, receipt.outputHash,
   BigInt(receipt.chainId), BigInt(receipt.blockNumber), BigInt(receipt.timestamp)],
))

// 2. Check the EIP-191 signature over the 32-byte hash
const valid = receiptHash === receipt.receiptHash && await verifyMessage({
  address: receipt.signer,
  message: { raw: receipt.receiptHash },
  signature: receipt.signature,
})

console.log(valid ? 'receipt is authentic' : 'tampered!')`,
  },
  {
    id: 'anchor',
    label: 'Anchor',
    file: 'anchor.js',
    code: `import { createWalletClient, custom } from 'viem'
import { bsc } from 'viem/chains'

const wallet = createWalletClient({ chain: bsc, transport: custom(window.ethereum) })
const [account] = await wallet.requestAddresses()

// 0-BNB tx to the Levium treasury, receipt id as calldata
const txHash = await wallet.sendTransaction({
  account,
  to: '0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76',
  value: 0n,
  data: receipt.id,
})

await fetch(\`\${API}/v1/anchor\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ receiptId: receipt.id, txHash }),
})`,
  },
]

function highlight(code: string) {
  // very small, safe tokenizer → React nodes
  const out: (string | JSX.Element)[] = []
  const re = /(\/\/[^\n]*)|('[^'\n]*'|`[^`]*`)|\b(const|await|import|from|new|return|async|function|true|false)\b|\b(\d+n?)\b/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index))
    const cls = m[1] ? 'tk-c' : m[2] ? 'tk-s' : m[3] ? 'tk-k' : 'tk-n'
    out.push(<span key={k++} className={cls}>{m[0]}</span>)
    last = m.index + m[0].length
  }
  if (last < code.length) out.push(code.slice(last))
  return out
}

export function Developers() {
  const [tab, setTab] = useState(SNIPPETS[0].id)
  const s = SNIPPETS.find((x) => x.id === tab) ?? SNIPPETS[0]
  return (
    <section className="section developers" id="developers">
      <div className="container dev-grid">
        <div>
          <SectionHead
            eyebrow="Developers"
            title={<>Five lines to <span className="grad-text">provable AI.</span></>}
            sub="A plain JSON API. Receipts verify with standard Ethereum tooling — no SDK lock-in, no trust in our servers."
          />
          <Reveal delay={0.15}>
            <ul className="dev-list">
              <li><span className="mono tag">POST</span> /v1/ask <span className="muted">— run a model, get a receipt</span></li>
              <li><span className="mono tag">POST</span> /v1/verify <span className="muted">— server-side verification</span></li>
              <li><span className="mono tag">POST</span> /v1/anchor <span className="muted">— record an on-chain anchor</span></li>
              <li><span className="mono tag lime">GET</span> /v1/feed <span className="muted">— recent receipts</span></li>
              <li><span className="mono tag lime">GET</span> /v1/models <span className="muted">— available models</span></li>
            </ul>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <div className="code-card">
            <div className="code-head">
              <div className="code-tabs" role="tablist">
                {SNIPPETS.map((x) => (
                  <button key={x.id} role="tab" aria-selected={x.id === tab} className={x.id === tab ? 'on' : ''} onClick={() => setTab(x.id)}>
                    {x.id === tab && <motion.span layoutId="code-tab" className="code-tab-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span>{x.label}</span>
                  </button>
                ))}
              </div>
              <CopyButton value={s.code} label="code" />
            </div>
            <div className="code-file mono">{s.file}</div>
            <pre className="code"><code>{highlight(s.code)}</code></pre>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
