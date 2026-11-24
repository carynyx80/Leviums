import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { bscTx, short, timeAgo } from '../lib/utils'
import { SectionHead, Reveal } from '../components/Reveal'
import { IconExternal } from '../components/Icons'
import { verdictClass } from './Playground'

export function Explorer() {
  const feed = useQuery({ queryKey: ['feed'], queryFn: () => api.feed(20), refetchInterval: 5000, retry: 1 })
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5000)
    return () => clearInterval(t)
  }, [])
  const items = Array.isArray(feed.data) ? feed.data : []

  return (
    <section className="section explorer" id="explorer">
      <div className="container">
        <SectionHead
          eyebrow="Live explorer"
          title={<>Every receipt, <span className="grad-text">in public.</span></>}
          sub="The latest receipts issued by Keelcodes nodes. Refreshes every 5 seconds."
        />
        <Reveal>
          <div className="explorer-card">
            <div className="explorer-head">
              <span className="explorer-status">
                <span className={`live-dot ${feed.isError ? 'off' : ''}`} />
                {feed.isError ? 'Node unreachable — retrying' : feed.isLoading ? 'Connecting…' : `${items.length} recent receipts`}
              </span>
              <span className="muted small mono">GET /v1/feed</span>
            </div>
            <div className="explorer-cols">
              <span>Model</span><span>Verdict</span><span>Receipt</span><span>Time</span><span>Anchor</span>
            </div>
            <div className="explorer-list">
              {feed.isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="explorer-row skeleton"><span /><span /><span /><span /><span /></div>
                ))}
              {!feed.isLoading && items.length === 0 && (
                <div className="explorer-empty">
                  {feed.isError ? 'The feed is offline right now. Receipts will stream in here as soon as the node is back.' : 'No receipts yet — be the first. Ask something in the Playground.'}
                </div>
              )}
              <AnimatePresence initial={false}>
                {items.map((r) => (
                  <motion.div
                    key={r.id}
                    layout
                    className="explorer-row"
                    initial={{ opacity: 0, y: -12, backgroundColor: 'rgba(200,255,46,0.08)' }}
                    animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(200,255,46,0)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <span className="mono model">{r.model}</span>
                    <span><span className={`verdict sm verdict-${verdictClass(r.output?.verdict)}`}>{r.output?.verdict ?? '—'}</span></span>
                    <span className="mono muted">{short(r.id, 8, 6)}</span>
                    <span className="muted">{timeAgo(r.timestamp)}</span>
                    <span>
                      {r.anchor?.txHash ? (
                        <a className="pill pill-lime link-pill" href={bscTx(r.anchor.txHash)} target="_blank" rel="noreferrer">
                          Anchored <IconExternal width={11} height={11} />
                        </a>
                      ) : (
                        <span className="pill pill-dim">Signed</span>
                      )}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
