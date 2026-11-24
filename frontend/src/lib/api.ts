export const API_URL = (import.meta.env.VITE_API_URL || 'https://levium-api-production.up.railway.app').replace(/\/+$/, '')

export const TREASURY = '0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76' as const

export type Severity = 'good' | 'warn' | 'bad'
export type Verdict = 'SAFE' | 'CAUTION' | 'DANGER' | string

export interface Signal {
  label: string
  severity: Severity
  detail?: string
}

export interface ModelOutput {
  score?: number
  verdict?: Verdict
  signals?: Signal[]
  token?: { name?: string; symbol?: string; decimals?: number; totalSupply?: string }
  liquidityBNB?: number | string
  ownerRenounced?: boolean
  balanceBNB?: number | string
  txCount?: number
  isContract?: boolean
  [k: string]: unknown
}

export interface Anchor {
  txHash: string
  blockNumber?: number
  from?: string
}

export interface Receipt {
  id: `0x${string}`
  model: string
  modelFingerprint: string
  input: Record<string, unknown>
  inputHash: string
  output: ModelOutput
  outputHash: string
  chainId: number
  blockNumber: number
  timestamp: number
  receiptHash: `0x${string}`
  signer: `0x${string}`
  signature: `0x${string}`
  tier: 'attested' | 'challengeable' | 'zk' | string
  anchor: Anchor | null
}

export interface ModelInfo {
  id: string
  name: string
  version?: string
  description?: string
  fingerprint?: string
  inputSchema?: Record<string, string>
  kind?: string
}

export interface Health {
  ok: boolean
  chainId: number
  signer: string
  treasury: string
  blockNumber: number
}

export interface Stats {
  totalReceipts: number
  anchored: number
  models: number
  signer: string
  uptimeSec: number
}

export interface VerifyResult {
  valid: boolean
  recoveredSigner?: string
  trustedSigner?: string
  hashesMatch?: boolean
  checks?: { label: string; ok: boolean }[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 30000)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && ('error' in data || 'message' in data)
          ? String((data as Record<string, unknown>).error ?? (data as Record<string, unknown>).message)
          : '') || `Request failed (${res.status})`
      throw new ApiError(msg, res.status)
    }
    return data as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e instanceof DOMException && e.name === 'AbortError') throw new ApiError('The Levium node took too long to respond.', 0)
    throw new ApiError('Could not reach the Levium node. Is the API online?', 0)
  } finally {
    clearTimeout(t)
  }
}

export const api = {
  health: () => request<Health>('/health', { timeoutMs: 8000 }),
  stats: () => request<Stats>('/v1/stats', { timeoutMs: 8000 }),
  models: () => request<ModelInfo[]>('/v1/models', { timeoutMs: 10000 }),
  feed: (limit = 20) => request<Receipt[]>(`/v1/feed?limit=${limit}`, { timeoutMs: 8000 }),
  receipt: (id: string) => request<Receipt>(`/v1/receipts/${id}`),
  ask: (model: string, input: Record<string, unknown>, requester?: string) =>
    request<Receipt>('/v1/ask', { method: 'POST', body: JSON.stringify({ model, input, requester }), timeoutMs: 60000 }),
  verify: (receipt: Receipt) => request<VerifyResult>('/v1/verify', { method: 'POST', body: JSON.stringify({ receipt }) }),
  anchor: (receiptId: string, txHash: string) =>
    request<Receipt>('/v1/anchor', { method: 'POST', body: JSON.stringify({ receiptId, txHash }), timeoutMs: 60000 }),
}
