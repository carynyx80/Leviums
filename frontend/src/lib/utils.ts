export const short = (s?: string | null, a = 6, b = 4) => {
  if (!s) return '—'
  return s.length <= a + b + 2 ? s : `${s.slice(0, a)}…${s.slice(-b)}`
}

export const timeAgo = (ts?: number) => {
  if (!ts) return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  const d = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (d < 5) return 'just now'
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export const fmtNum = (n?: number | null) => (typeof n === 'number' && isFinite(n) ? n.toLocaleString('en-US') : '—')

export const bscTx = (h: string) => `https://bscscan.com/tx/${h}`
export const bscAddr = (a: string) => `https://bscscan.com/address/${a}`

export function errMessage(e: unknown): string {
  if (!e) return 'Something went wrong.'
  const anyE = e as { shortMessage?: string; message?: string; name?: string; code?: number; cause?: unknown }
  const text = `${anyE.name ?? ''} ${anyE.shortMessage ?? ''} ${anyE.message ?? ''}`
  if (anyE.code === 4001 || /UserRejected|rejected|denied|cancel/i.test(text)) return 'Request cancelled in your wallet.'
  if (/insufficient funds/i.test(text)) return 'Not enough BNB to pay gas.'
  if (/ConnectorNotConnected|not connected/i.test(text)) return 'Wallet not connected.'
  if (/already pending|-32002/i.test(text)) return 'A wallet request is already pending — open your wallet.'
  return anyE.shortMessage || anyE.message?.split('\n')[0] || 'Something went wrong.'
}

export async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    try {
      const el = document.createElement('textarea')
      el.value = t
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
      return true
    } catch {
      return false
    }
  }
}
