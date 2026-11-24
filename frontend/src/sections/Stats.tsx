import { useQuery } from '@tanstack/react-query'
import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useBlockNumber } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { api } from '../lib/api'
import { bscAddr, short } from '../lib/utils'
import { Reveal } from '../components/Reveal'

function Counter({ value }: { value: number | null }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    if (value == null || !inView) return
    if (reduce) {
      setShown(value)
      return
    }
    const c = animate(prev.current, value, { duration: prev.current === 0 ? 1.4 : 0.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(Math.round(v)) })
    prev.current = value
    return () => c.stop()
  }, [value, inView, reduce])
  return <span ref={ref}>{value == null ? '—' : shown.toLocaleString('en-US')}</span>
}

export function Stats() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats, refetchInterval: 10000, retry: 1 })
  const health = useQuery({ queryKey: ['health'], queryFn: api.health, refetchInterval: 15000, retry: 1 })
  const { data: chainBlock } = useBlockNumber({ chainId: bsc.id, watch: true, query: { refetchInterval: 6000 } })
  const offline = stats.isError && health.isError
  const signer = stats.data?.signer || health.data?.signer
  const block = chainBlock != null ? Number(chainBlock) : health.data?.blockNumber ?? null

  return (
    <section className="stats-wrap">
      <div className="container">
        <Reveal>
          <div className="stats">
            <div className="stat">
              <span className="stat-label">Receipts issued</span>
              <span className="stat-value"><Counter value={stats.data?.totalReceipts ?? null} /></span>
            </div>
            <div className="stat">
              <span className="stat-label">Anchored on BNB</span>
              <span className="stat-value lime"><Counter value={stats.data?.anchored ?? null} /></span>
            </div>
            <div className="stat">
              <span className="stat-label"><span className="live-dot" /> BNB block</span>
              <span className="stat-value mono-num">{block != null ? `#${block.toLocaleString('en-US')}` : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Attestation signer</span>
              <span className="stat-value small-val">
                {signer ? (
                  <a className="mono link" href={bscAddr(signer)} target="_blank" rel="noreferrer">{short(signer, 6, 4)}</a>
                ) : (
                  <span className="mono muted">{offline ? 'node offline' : 'loading…'}</span>
                )}
              </span>
            </div>
          </div>
          {offline && <p className="stats-note">Live stats are temporarily unavailable — the Keelcodes node isn’t responding. Chain data above is read directly from BNB mainnet.</p>}
        </Reveal>
      </div>
    </section>
  )
}
