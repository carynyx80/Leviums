import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, type Connector } from 'wagmi'
import { bsc } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { bscAddr, copyText, errMessage, short } from '../lib/utils'
import { useToast } from '../lib/toast'
import { IconChevron, IconCopy, IconExternal, IconLogout, IconWallet, IconX } from './Icons'

/* ---------- modal context ---------- */
const ModalCtx = createContext<{ open: () => void }>({ open: () => {} })
export const useWalletModal = () => useContext(ModalCtx)

export function WalletModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const value = useMemo(() => ({ open: () => setOpen(true) }), [])
  return (
    <ModalCtx.Provider value={value}>
      {children}
      <WalletModal open={isOpen} onClose={() => setOpen(false)} />
    </ModalCtx.Provider>
  )
}

/* ---------- connector helpers ---------- */
const FALLBACK_ICONS: Record<string, string> = {
  coinbaseWalletSDK:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#0052FF"/><circle cx="20" cy="20" r="11" fill="#fff"/><rect x="16" y="16" width="8" height="8" rx="1.5" fill="#0052FF"/></svg>'),
  walletConnect:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#3B99FC"/><path d="M12.5 16.2c4.1-4 10.9-4 15 0l.5.5c.2.2.2.5 0 .7l-1.7 1.7c-.1.1-.3.1-.4 0l-.7-.7c-2.9-2.8-7.5-2.8-10.4 0l-.7.7c-.1.1-.3.1-.4 0L12 17.4c-.2-.2-.2-.5 0-.7zm18.5 3.4 1.5 1.5c.2.2.2.5 0 .7l-6.8 6.6c-.2.2-.5.2-.7 0L20.2 23.7c-.1-.1-.1-.1-.2 0l-4.8 4.7c-.2.2-.5.2-.7 0L7.7 21.8c-.2-.2-.2-.5 0-.7l1.5-1.5c.2-.2.5-.2.7 0l4.8 4.7c.1.1.1.1.2 0l4.8-4.7c.2-.2.5-.2.7 0l4.8 4.7c.1.1.1.1.2 0l4.8-4.7c.2-.2.5-.2.7 0z" fill="#fff"/></svg>'),
  injected:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#1a1a1f"/><path d="M28 15v-2a2 2 0 0 0-2-2H12a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" stroke="#C8FF2E" stroke-width="2" fill="none"/><path d="M30 17h-6a3 3 0 0 0 0 6h6z" stroke="#FF2E9A" stroke-width="2" fill="none"/></svg>'),
}

function connectorLabel(c: Connector) {
  if (c.id === 'injected') return 'Browser Wallet'
  if (c.id === 'walletConnect') return 'WalletConnect'
  return c.name
}
function connectorHint(c: Connector) {
  if (c.id === 'walletConnect') return 'Scan with any mobile wallet'
  if (c.id === 'coinbaseWalletSDK') return 'Coinbase Wallet & Smart Wallet'
  if (c.id === 'injected') return 'Use the detected extension'
  return 'Detected'
}

function useWalletList() {
  const { connectors } = useConnect()
  return useMemo(() => {
    const hasWindowEth = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum
    // EIP-6963 discovered connectors have type 'injected' and an rdns-style id
    const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected')
    const seen = new Set<string>()
    const out: Connector[] = []
    for (const c of connectors) {
      if (c.id === 'injected' && (discovered.length > 0 || !hasWindowEth)) continue
      const key = connectorLabel(c).toLowerCase().replace(/\s+/g, '')
      // prefer discovered extension over SDK duplicate (e.g. Coinbase)
      if (c.id === 'coinbaseWalletSDK' && discovered.some((d) => /coinbase/i.test(d.name))) continue
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
    const injectedCount = out.filter((c) => c.type === 'injected').length
    return { list: out, noInjected: injectedCount === 0 }
  }, [connectors])
}

/* ---------- modal ---------- */
function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { list, noInjected } = useWalletList()
  const { connectAsync } = useConnect()
  const { isConnected } = useAccount()
  const toast = useToast()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open && isConnected && !pending) onClose()
  }, [isConnected, open, pending, onClose])

  const connect = async (c: Connector) => {
    setPending(c.uid)
    try {
      await connectAsync({ connector: c, chainId: bsc.id })
      toast('Wallet connected', 'success')
      onClose()
    } catch (e) {
      const msg = errMessage(e)
      if (/already connected/i.test(msg)) onClose()
      else toast(msg, 'error')
    } finally {
      setPending(null)
    }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Connect a wallet"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-glow" />
            <div className="modal-head">
              <div>
                <h3>Connect wallet</h3>
                <p>BNB Smart Chain · mainnet</p>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <IconX />
              </button>
            </div>
            <div className="wallet-list">
              {list.map((c, i) => (
                <motion.button
                  key={c.uid}
                  className="wallet-item"
                  onClick={() => connect(c)}
                  disabled={!!pending}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  <img src={c.icon || FALLBACK_ICONS[c.id] || FALLBACK_ICONS.injected} alt="" width={36} height={36} />
                  <span className="wallet-meta">
                    <span className="wallet-name">{connectorLabel(c)}</span>
                    <span className="wallet-hint">{connectorHint(c)}</span>
                  </span>
                  {pending === c.uid ? <span className="spinner" /> : c.type === 'injected' ? <span className="pill pill-lime">Detected</span> : null}
                </motion.button>
              ))}
            </div>
            {noInjected && (
              <div className="no-wallet">
                <strong>No wallet detected</strong>
                <span>
                  Install{' '}
                  <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                    MetaMask
                  </a>{' '}
                  or{' '}
                  <a href="https://trustwallet.com/download" target="_blank" rel="noreferrer">
                    Trust Wallet
                  </a>{' '}
                  and refresh this page.
                </span>
              </div>
            )}
            <p className="modal-foot">Keelcodes never asks for your seed phrase. Connecting is free and read-only.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------- button ---------- */
export function WalletButton({ compact }: { compact?: boolean }) {
  const { address, isConnected, chainId, connector, status } = useAccount()
  const { open } = useWalletModal()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { data: bal } = useBalance({ address, chainId: bsc.id, query: { enabled: !!address, refetchInterval: 20000 } })

  useEffect(() => {
    if (!menu) return
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menu])

  if (!isConnected || !address) {
    return (
      <button className="btn btn-primary btn-sm" onClick={open} disabled={status === 'reconnecting'}>
        <IconWallet width={16} height={16} />
        <span>{status === 'reconnecting' ? 'Reconnecting…' : compact ? 'Connect' : 'Connect Wallet'}</span>
      </button>
    )
  }

  if (chainId !== bsc.id) {
    return (
      <button
        className="btn btn-warn btn-sm"
        disabled={switching}
        onClick={async () => {
          try {
            await switchChainAsync({ chainId: bsc.id })
            toast('Switched to BNB Chain', 'success')
          } catch (e) {
            toast(errMessage(e), 'error')
          }
        }}
      >
        {switching ? <span className="spinner sm" /> : <span className="dot-warn" />}
        Switch to BNB Chain
      </button>
    )
  }

  const balText = bal ? `${Number(formatUnits(bal.value, bal.decimals)).toLocaleString('en-US', { maximumFractionDigits: 4 })} BNB` : '… BNB'

  return (
    <div className="acct" ref={ref}>
      <button className="acct-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        <span className="acct-bal">{balText}</span>
        <span className="acct-addr">
          {connector?.icon ? <img src={connector.icon} alt="" width={16} height={16} /> : <span className="acct-avatar" />}
          {short(address, 5, 4)}
        </span>
        <IconChevron width={14} height={14} />
      </button>
      <AnimatePresence>
        {menu && (
          <motion.div
            className="acct-menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="acct-menu-head">
              <span className="mono">{short(address, 8, 6)}</span>
              <span className="muted">{connector?.name} · BNB Chain</span>
            </div>
            <button
              onClick={async () => {
                await copyText(address)
                toast('Address copied', 'success')
                setMenu(false)
              }}
            >
              <IconCopy /> Copy address
            </button>
            <a href={bscAddr(address)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
              <IconExternal /> View on BscScan
            </a>
            <button
              className="danger"
              onClick={() => {
                disconnect()
                setMenu(false)
                toast('Disconnected', 'info')
              }}
            >
              <IconLogout /> Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
