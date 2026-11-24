import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useAccount, useConfig, useSendTransaction, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { bsc } from 'wagmi/chains'
import { isAddress, isHex } from 'viem'
import { api, TREASURY, type ModelInfo, type Receipt, type VerifyResult } from '../lib/api'
import { bscTx, errMessage, short } from '../lib/utils'
import { useToast } from '../lib/toast'
import { SectionHead, Reveal } from '../components/Reveal'
import { CopyButton } from '../components/CopyButton'
import { useWalletModal } from '../components/Wallet'
import { IconAnchor, IconArrow, IconCheck, IconExternal, IconShield, IconX } from '../components/Icons'

const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'rugscan-v1', name: 'RugScan', description: 'Token rug-pull risk on BNB Chain', inputSchema: { token: 'address' } },
  { id: 'walletscan-v1', name: 'WalletScan', description: 'Wallet reputation & risk', inputSchema: { address: 'address' } },
]
const EXAMPLES: Record<string, string> = {
  token: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3',
}

type AnchorStage = 'idle' | 'switching' | 'signing' | 'mining' | 'submitting' | 'done'

export function Playground() {
  const toast = useToast()
  const qc = useQueryClient()
  const modelsQ = useQuery({ queryKey: ['models'], queryFn: api.models, retry: 1, staleTime: 60000 })
  const models = modelsQ.data && Array.isArray(modelsQ.data) && modelsQ.data.length ? modelsQ.data : FALLBACK_MODELS
  const [modelId, setModelId] = useState('rugscan-v1')
  const model = models.find((m) => m.id === modelId) ?? models[0]
  const field = useMemo(() => Object.keys(model?.inputSchema ?? {})[0] ?? (model?.id.startsWith('wallet') ? 'address' : 'token'), [model])
  const [values, setValues] = useState<Record<string, string>>({ token: EXAMPLES.token, address: EXAMPLES.address })
  const value = values[field] ?? ''
  const valid = isAddress(value.trim(), { strict: false })

  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [anchorStage, setAnchorStage] = useState<AnchorStage>('idle')
  const [anchorHash, setAnchorHash] = useState<string | null>(null)
  const [anchorErr, setAnchorErr] = useState<string | null>(null)

  const ask = useMutation({
    mutationFn: () => api.ask(model.id, { [field]: value.trim() }),
    onMutate: () => {
      setVerify(null)
      setAnchorStage('idle')
      setAnchorHash(null)
      setAnchorErr(null)
    },
    onSuccess: (r) => {
      setReceipt(r)
      if (r.anchor?.txHash) {
        setAnchorHash(r.anchor.txHash)
        setAnchorStage('done')
      }
      qc.invalidateQueries({ queryKey: ['feed'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const verifyM = useMutation({
    mutationFn: (r: Receipt) => api.verify(r),
    onSuccess: (v) => {
      setVerify(v)
      toast(v.valid ? 'Receipt verified ✓' : 'Receipt failed verification', v.valid ? 'success' : 'error')
    },
    onError: (e) => toast(errMessage(e), 'error'),
  })

  // ---- anchoring ----
  const { isConnected, chainId } = useAccount()
  const { open: openWallet } = useWalletModal()
  const { switchChainAsync } = useSwitchChain()
  const { sendTransactionAsync } = useSendTransaction()
  const config = useConfig()

  const anchor = async () => {
    if (!receipt) return
    if (!isConnected) {
      openWallet()
      return
    }
    if (!isHex(receipt.id)) {
      toast('Receipt id is not valid hex', 'error')
      return
    }
    setAnchorErr(null)
    try {
      if (chainId !== bsc.id) {
        setAnchorStage('switching')
        await switchChainAsync({ chainId: bsc.id })
      }
      setAnchorStage('signing')
      const hash = await sendTransactionAsync({ to: TREASURY, value: 0n, data: receipt.id, chainId: bsc.id })
      setAnchorHash(hash)
      setAnchorStage('mining')
      const txr = await waitForTransactionReceipt(config, { hash, chainId: bsc.id, confirmations: 1, timeout: 180_000 })
      if (txr.status !== 'success') throw new Error('Transaction reverted on-chain.')
      setAnchorStage('submitting')
      try {
        const updated = await api.anchor(receipt.id, hash)
        if (updated && typeof updated === 'object' && 'id' in updated) setReceipt(updated)
        else setReceipt({ ...receipt, anchor: { txHash: hash, blockNumber: Number(txr.blockNumber) } })
        qc.invalidateQueries({ queryKey: ['feed'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      } catch (e) {
        // tx is on-chain regardless; surface backend issue softly
        setReceipt({ ...receipt, anchor: { txHash: hash, blockNumber: Number(txr.blockNumber) } })
        toast(`Anchored on-chain, but the node couldn't record it: ${errMessage(e)}`, 'info')
      }
      setAnchorStage('done')
      toast('Receipt anchored on BNB mainnet', 'success')
    } catch (e) {
      const msg = errMessage(e)
      setAnchorErr(msg)
      setAnchorStage(anchorHash ? 'done' : 'idle')
      toast(msg, 'error')
    }
  }

  const anchorLabel: Record<AnchorStage, string> = {
    idle: isConnected ? (chainId === bsc.id ? 'Anchor on BNB' : 'Switch & anchor') : 'Connect to anchor',
    switching: 'Switching network…',
    signing: 'Confirm in wallet…',
    mining: 'Waiting for block…',
    submitting: 'Recording anchor…',
    done: 'Anchored',
  }
  const anchorBusy = ['switching', 'signing', 'mining', 'submitting'].includes(anchorStage)
  const out = receipt?.output

  return (
    <section className="section playground" id="playground">
      <div className="orb orb-lime small" style={{ top: '10%', right: '-12%' }} />
      <div className="container">
        <SectionHead
          eyebrow="Playground"
          title={<>Ask. Get an answer. <span className="grad-text">Keep the receipt.</span></>}
          sub="Real models, real BNB mainnet data. Every response below is signed and verifiable — try anchoring one."
        />
        <Reveal>
          <div className="pg">
            <form
              className="pg-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (valid && !ask.isPending) ask.mutate()
              }}
            >
              <div className="pg-models" role="tablist" aria-label="Model">
                {models.map((m) => (
                  <button type="button" role="tab" aria-selected={m.id === model.id} key={m.id} className={`pg-model ${m.id === model.id ? 'on' : ''}`} onClick={() => setModelId(m.id)}>
                    {m.id === model.id && <motion.span layoutId="pg-model-bg" className="pg-model-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span className="pg-model-name mono">{m.id}</span>
                    <span className="pg-model-desc">{m.description || m.name}</span>
                  </button>
                ))}
              </div>
              <label className="pg-label" htmlFor="pg-input">
                {field === 'token' ? 'Token contract address' : 'Wallet address'} <span className="muted">· BNB Chain</span>
              </label>
              <div className={`pg-input-row ${value && !valid ? 'invalid' : ''}`}>
                <input
                  id="pg-input"
                  className="mono"
                  value={value}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="0x…"
                  onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                />
                <button type="submit" className="btn btn-primary" disabled={!valid || ask.isPending}>
                  {ask.isPending ? <><span className="spinner sm dark" /> Running…</> : <>Ask Levium <IconArrow width={16} height={16} /></>}
                </button>
              </div>
              <div className="pg-hints">
                {value && !valid ? <span className="err-text">Enter a valid 0x address</span> : <span className="muted">Example: {field === 'token' ? 'CAKE (PancakeSwap)' : 'a Binance hot wallet'}</span>}
                <button type="button" className="link-btn" onClick={() => setValues((v) => ({ ...v, [field]: EXAMPLES[field] ?? '' }))}>Use example</button>
              </div>
              {modelsQ.isError && <p className="pg-note">Model list unavailable — using built-in defaults.</p>}
            </form>

            <AnimatePresence mode="wait">
              {ask.isPending && (
                <motion.div key="loading" className="pg-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="scan-line" />
                  <div className="pg-loading-steps">
                    <span>Reading BNB mainnet state…</span>
                    <span>Running {model.id} in sealed node…</span>
                    <span>Hashing & signing receipt…</span>
                  </div>
                </motion.div>
              )}
              {ask.isError && !ask.isPending && (
                <motion.div key="err" className="pg-error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <IconX width={18} height={18} />
                  <div>
                    <strong>Couldn’t get an answer</strong>
                    <p>{errMessage(ask.error)}</p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => ask.mutate()}>Retry</button>
                </motion.div>
              )}
              {receipt && !ask.isPending && !ask.isError && (
                <motion.div key={receipt.id} className="pg-result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
                  {/* Answer */}
                  <div className="pg-answer card">
                    <div className="card-head">
                      <span className="eyebrow sm">Answer</span>
                      <span className="mono muted small">{receipt.model}</span>
                    </div>
                    <div className="answer-top">
                      <ScoreDial score={Number(out?.score ?? 0)} verdict={String(out?.verdict ?? '')} />
                      <div className="answer-meta">
                        <span className={`verdict verdict-${verdictClass(out?.verdict)}`}>{out?.verdict ?? '—'}</span>
                        {out?.token && (
                          <div className="answer-token">
                            <strong>{out.token.name ?? 'Unknown'}</strong> <span className="muted">{out.token.symbol ? `$${out.token.symbol}` : ''}</span>
                          </div>
                        )}
                        <div className="answer-facts">
                          {out?.liquidityBNB != null && <span>Liquidity <b>{fmtMaybe(out.liquidityBNB)} BNB</b></span>}
                          {out?.ownerRenounced != null && <span>Owner <b>{out.ownerRenounced ? 'renounced' : 'active'}</b></span>}
                          {out?.balanceBNB != null && <span>Balance <b>{fmtMaybe(out.balanceBNB)} BNB</b></span>}
                          {out?.txCount != null && <span>Txs <b>{Number(out.txCount).toLocaleString('en-US')}</b></span>}
                          {out?.isContract != null && <span>Type <b>{out.isContract ? 'contract' : 'EOA'}</b></span>}
                        </div>
                      </div>
                    </div>
                    <ul className="signals">
                      {(out?.signals ?? []).map((s, i) => (
                        <motion.li key={i} className={`signal sev-${s.severity}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
                          <span className="sev-dot" />
                          <div>
                            <strong>{s.label}</strong>
                            {s.detail && <p>{s.detail}</p>}
                          </div>
                        </motion.li>
                      ))}
                      {!out?.signals?.length && <li className="muted small">No signals returned.</li>}
                    </ul>
                  </div>

                  {/* Receipt */}
                  <div className="pg-receipt card">
                    <div className="card-head">
                      <span className="eyebrow sm">Receipt</span>
                      <span className="pill pill-lime">{(receipt.tier || 'attested').toUpperCase()}</span>
                    </div>
                    <dl className="kv">
                      <KV k="Receipt ID" v={receipt.id} />
                      <KV k="Model fingerprint" v={receipt.modelFingerprint} />
                      <KV k="Input hash" v={receipt.inputHash} />
                      <KV k="Output hash" v={receipt.outputHash} />
                      <KV k="Signer" v={receipt.signer} />
                      <KV k="Signature" v={receipt.signature} />
                      <div className="kv-row">
                        <dt>Block · time</dt>
                        <dd className="mono">#{Number(receipt.blockNumber).toLocaleString('en-US')} · {new Date(receipt.timestamp * 1000).toLocaleString()}</dd>
                      </div>
                    </dl>
                    <div className="pg-actions">
                      <button className="btn btn-ghost" onClick={() => verifyM.mutate(receipt)} disabled={verifyM.isPending}>
                        {verifyM.isPending ? <span className="spinner sm" /> : <IconShield width={16} height={16} />} Verify receipt
                      </button>
                      {anchorStage === 'done' && (anchorHash || receipt.anchor?.txHash) ? (
                        <a className="btn btn-lime" href={bscTx(anchorHash || receipt.anchor!.txHash)} target="_blank" rel="noreferrer">
                          <IconCheck width={16} height={16} /> Anchored · BscScan <IconExternal width={14} height={14} />
                        </a>
                      ) : (
                        <button className="btn btn-primary" onClick={anchor} disabled={anchorBusy}>
                          {anchorBusy ? <span className="spinner sm dark" /> : <IconAnchor width={16} height={16} />} {anchorLabel[anchorStage]}
                        </button>
                      )}
                    </div>
                    {anchorHash && anchorStage !== 'done' && (
                      <p className="pg-note">
                        Tx sent: <a className="mono link" href={bscTx(anchorHash)} target="_blank" rel="noreferrer">{short(anchorHash, 10, 8)}</a>
                      </p>
                    )}
                    {anchorErr && <p className="err-text small">{anchorErr}</p>}
                    {!anchorHash && anchorStage === 'idle' && (
                      <p className="pg-note">Anchoring sends a 0 BNB tx to the Levium treasury with the receipt id as calldata. You only pay gas (~$0.01).</p>
                    )}
                    <AnimatePresence>
                      {verify && (
                        <motion.div className={`verify-box ${verify.valid ? 'ok' : 'bad'}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <div className="verify-head">
                            {verify.valid ? <IconCheck /> : <IconX />}
                            <strong>{verify.valid ? 'Valid receipt' : 'Invalid receipt'}</strong>
                          </div>
                          <ul>
                            {(verify.checks ?? []).map((c, i) => (
                              <motion.li key={i} className={c.ok ? 'ok' : 'bad'} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                                <span className="tick">{c.ok ? '✓' : '✕'}</span> {c.label}
                              </motion.li>
                            ))}
                          </ul>
                          {verify.recoveredSigner && (
                            <p className="mono small muted">recovered {short(verify.recoveredSigner, 8, 6)}{verify.trustedSigner ? ` · trusted ${short(verify.trustedSigner, 8, 6)}` : ''}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
              {!receipt && !ask.isPending && !ask.isError && (
                <motion.div key="empty" className="pg-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="pg-empty-receipt">
                    {Array.from({ length: 6 }).map((_, i) => <span key={i} style={{ width: `${90 - i * 9}%` }} />)}
                  </div>
                  <p>Your answer and its signed receipt will appear here.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function KV({ k, v }: { k: string; v?: string }) {
  return (
    <div className="kv-row">
      <dt>{k}</dt>
      <dd>
        <span className="mono" title={v}>{short(v, 10, 8)}</span>
        {v && <CopyButton value={v} label={undefined} />}
      </dd>
    </div>
  )
}

const fmtMaybe = (v: number | string) => {
  const n = Number(v)
  return isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(v)
}

export const verdictClass = (v?: string) => (v === 'SAFE' ? 'safe' : v === 'DANGER' ? 'danger' : v === 'CAUTION' ? 'caution' : 'neutral')

function ScoreDial({ score, verdict }: { score: number; verdict: string }) {
  const s = Math.max(0, Math.min(100, isFinite(score) ? score : 0))
  const color = verdict === 'SAFE' ? 'var(--lime)' : verdict === 'DANGER' ? 'var(--pink)' : verdict === 'CAUTION' ? 'var(--amber)' : 'var(--text-dim)'
  const C = 2 * Math.PI * 52
  const arc = C * 0.75
  return (
    <div className="dial">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" strokeDasharray={`${arc} ${C}`} strokeLinecap="round" transform="rotate(135 60 60)" />
        <motion.circle
          cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" transform="rotate(135 60 60)"
          strokeDasharray={`${arc} ${C}`} initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: arc * (1 - s / 100) }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} style={{ filter: `drop-shadow(0 0 10px ${color})` }}
        />
      </svg>
      <div className="dial-val">
        <span>{Math.round(s)}</span>
        <small>/ 100</small>
      </div>
    </div>
  )
}
