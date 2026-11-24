import { JsonRpcProvider, Network } from "ethers";
import { RPC_URLS, CHAIN_ID } from "./config.js";

const network = Network.from(CHAIN_ID);
// staticNetwork: skip per-request chainId detection; we verify chainId explicitly at startup.
export const providers = RPC_URLS.map(
  (url) => new JsonRpcProvider(url, network, { staticNetwork: network, batchMaxCount: 1 })
);

let preferred = 0;

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

/**
 * Run fn(provider) against each RPC in turn (starting from the last one that worked).
 * The whole fn runs against a single provider so multi-call analyses see consistent state.
 * Errors flagged with err.noRetry are rethrown immediately.
 */
export async function withProvider(fn, { timeoutMs = 20000 } = {}) {
  let lastErr;
  for (let i = 0; i < providers.length; i++) {
    const idx = (preferred + i) % providers.length;
    try {
      const res = await withTimeout(fn(providers[idx]), timeoutMs, "RPC");
      preferred = idx;
      return res;
    } catch (err) {
      if (err && err.noRetry) throw err;
      lastErr = err;
      console.warn(`[rpc] ${RPC_URLS[idx]} failed: ${err?.shortMessage || err?.message}`);
    }
  }
  const e = new Error(`All RPC endpoints failed: ${lastErr?.shortMessage || lastErr?.message}`);
  e.status = 502;
  throw e;
}

/** Verify each RPC reports chainId 56. Throws if none do or any reports a different chain. */
export async function assertMainnet() {
  let okCount = 0;
  for (let i = 0; i < providers.length; i++) {
    try {
      const hex = await withTimeout(providers[i].send("eth_chainId", []), 10000, "eth_chainId");
      const id = Number(BigInt(hex));
      if (id !== CHAIN_ID) throw Object.assign(new Error(`RPC ${RPC_URLS[i]} is chainId ${id}, expected ${CHAIN_ID}`), { fatal: true });
      okCount++;
    } catch (err) {
      if (err.fatal) throw err;
      console.warn(`[rpc] could not reach ${RPC_URLS[i]}: ${err?.message}`);
    }
  }
  if (!okCount) throw new Error("No BSC RPC endpoint reachable");
  return okCount;
}

let bnCache = { value: null, at: 0 };
export async function getCachedBlockNumber() {
  if (bnCache.value !== null && Date.now() - bnCache.at < 3000) return bnCache.value;
  const value = await withProvider((p) => p.getBlockNumber(), { timeoutMs: 8000 });
  bnCache = { value, at: Date.now() };
  return value;
}
