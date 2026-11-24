// rugscan-v1 — deterministic BEP-20 token risk scan from on-chain state at a fixed block.
// Changing this file changes the model fingerprint (sha256 of this source).
import { Contract, id as keccakId, formatEther, formatUnits, ZeroAddress } from "ethers";
import { PANCAKE_V2_FACTORY, WBNB } from "../config.js";
import { requireAddress, clamp, verdictFor, round } from "./util.js";

export const meta = {
  id: "rugscan-v1",
  name: "RugScan",
  version: "1.0.0",
  description:
    "Deterministic BEP-20 token risk scan: contract code, ownership, PancakeSwap V2 WBNB liquidity, risky admin functions and proxy upgradeability, evaluated at a fixed mainnet block.",
  inputSchema: { token: "address" },
  kind: "deterministic",
};

const DEAD = "0x000000000000000000000000000000000000dEaD".toLowerCase();
const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Risky function signatures; selectors are derived via keccak256 and searched as PUSH4 operands in bytecode.
const RISKY = [
  { group: "mint", label: "Mint function", penalty: 20, sigs: ["mint(address,uint256)", "mint(uint256)", "mintTo(address,uint256)"] },
  { group: "blacklist", label: "Blacklist function", penalty: 15, sigs: ["blacklist(address)", "addToBlacklist(address)", "setBlacklist(address,bool)", "blacklistAddress(address,bool)", "addBot(address)", "setBots(address[])"] },
  { group: "fee", label: "Adjustable fees", penalty: 10, sigs: ["setFee(uint256)", "setTaxFee(uint256)", "setFees(uint256,uint256)", "setLiquidityFeePercent(uint256)", "setTaxFeePercent(uint256)", "updateFees(uint256,uint256)", "setSellFee(uint256)", "setBuyFee(uint256)"] },
  { group: "pause", label: "Pausable transfers", penalty: 10, sigs: ["pause()", "setTradingEnabled(bool)", "enableTrading(bool)"] },
  { group: "maxtx", label: "Max transaction limit", penalty: 5, sigs: ["setMaxTxAmount(uint256)", "setMaxTxPercent(uint256)", "setMaxWalletSize(uint256)", "setMaxWallet(uint256)"] },
].map((g) => ({ ...g, selectors: g.sigs.map((s) => ({ sig: s, sel: keccakId(s).slice(2, 10) })) }));

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function owner() view returns (address)",
];
const FACTORY_ABI = ["function getPair(address,address) view returns (address)"];
const PAIR_ABI = [
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
];

export function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("input must be an object"), { status: 400, noRetry: true });
  return { token: requireAddress(input.token, "token") };
}

async function tryCall(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function run({ token }, { provider, blockNumber }) {
  const blockTag = blockNumber;
  const signals = [];
  const sig = (label, severity, detail) => signals.push({ label, severity, detail });
  const code = await provider.getCode(token, blockTag);

  if (!code || code === "0x") {
    sig("Not a contract", "bad", "No bytecode at this address — it is not a token contract.");
    return {
      score: 0,
      verdict: "DANGER",
      token: { name: null, symbol: null, decimals: null, totalSupply: null },
      liquidityBNB: 0,
      ownerRenounced: false,
      isProxy: false,
      riskyFunctions: [],
      signals,
    };
  }

  let score = 100;
  const c = new Contract(token, ERC20_ABI, provider);
  const o = { blockTag };
  const [name, symbol, decimalsRaw, supplyRaw, owner] = await Promise.all([
    tryCall(() => c.name(o)),
    tryCall(() => c.symbol(o)),
    tryCall(() => c.decimals(o)),
    tryCall(() => c.totalSupply(o)),
    tryCall(() => c.owner(o)),
  ]);
  const decimals = decimalsRaw === null ? null : Number(decimalsRaw);
  const totalSupply = supplyRaw === null ? null : decimals !== null ? formatUnits(supplyRaw, decimals) : supplyRaw.toString();

  if (symbol === null || supplyRaw === null || decimals === null) {
    score -= 30;
    sig("Non-standard token", "bad", "One or more BEP-20 metadata calls (symbol/decimals/totalSupply) failed.");
  } else {
    sig("BEP-20 metadata", "good", `${name ?? "?"} (${symbol}), ${decimals} decimals.`);
  }

  // Ownership
  let ownerRenounced = false;
  if (owner === null) {
    sig("No owner() function", "good", "Contract exposes no Ownable owner().");
    ownerRenounced = true;
  } else if (owner.toLowerCase() === ZeroAddress || owner.toLowerCase() === DEAD) {
    ownerRenounced = true;
    sig("Ownership renounced", "good", `owner() = ${owner}`);
  } else {
    score -= 10;
    sig("Owner active", "warn", `owner() = ${owner}; privileged functions can still be called.`);
  }

  // Liquidity on PancakeSwap V2 vs WBNB
  let liquidityBNB = 0;
  const factory = new Contract(PANCAKE_V2_FACTORY, FACTORY_ABI, provider);
  const pair = token.toLowerCase() === WBNB.toLowerCase() ? null : await tryCall(() => factory.getPair(token, WBNB, o));
  if (pair && pair !== ZeroAddress) {
    const p = new Contract(pair, PAIR_ABI, provider);
    const [t0, reserves] = await Promise.all([tryCall(() => p.token0(o)), tryCall(() => p.getReserves(o))]);
    if (t0 && reserves) {
      const bnbReserve = t0.toLowerCase() === WBNB.toLowerCase() ? reserves[0] : reserves[1];
      liquidityBNB = round(formatEther(bnbReserve), 4);
    }
  }
  if (token.toLowerCase() === WBNB.toLowerCase()) {
    sig("Wrapped BNB", "good", "Token is WBNB itself.");
  } else if (!pair || pair === ZeroAddress) {
    score -= 30;
    sig("No PancakeSwap V2 WBNB pair", "bad", "No V2 pool against WBNB — may be untradeable or liquidity elsewhere.");
  } else if (liquidityBNB < 10) {
    score -= 20;
    sig("Low liquidity", "bad", `${liquidityBNB} BNB in the PancakeSwap V2 pool (${pair}).`);
  } else if (liquidityBNB < 100) {
    score -= 8;
    sig("Moderate liquidity", "warn", `${liquidityBNB} BNB in the PancakeSwap V2 pool (${pair}).`);
  } else {
    sig("Deep liquidity", "good", `${liquidityBNB} BNB in the PancakeSwap V2 pool (${pair}).`);
  }

  // Risky selectors in bytecode (PUSH4 <selector>)
  const hex = code.toLowerCase();
  const riskyFunctions = [];
  for (const g of RISKY) {
    const hits = g.selectors.filter((s) => hex.includes("63" + s.sel)).map((s) => s.sig);
    if (hits.length) {
      riskyFunctions.push(...hits);
      const penalty = ownerRenounced ? Math.ceil(g.penalty / 2) : g.penalty;
      score -= penalty;
      sig(g.label, ownerRenounced ? "warn" : "bad", `Bytecode contains ${hits.join(", ")}${ownerRenounced ? " (owner renounced)" : ""}.`);
    }
  }
  if (!riskyFunctions.length) sig("No risky admin functions", "good", "No mint/blacklist/fee/pause/maxTx selectors found in bytecode.");

  // Proxy (EIP-1967)
  const implSlot = await tryCall(() => provider.getStorage(token, EIP1967_IMPL_SLOT, blockTag));
  const isProxy = !!implSlot && BigInt(implSlot) !== 0n;
  if (isProxy) {
    score -= 15;
    sig("Upgradeable proxy", "bad", `EIP-1967 implementation = 0x${implSlot.slice(-40)}; logic can be swapped.`);
  } else {
    sig("Not an EIP-1967 proxy", "good", "Implementation slot is empty.");
  }

  score = clamp(score);
  return {
    score,
    verdict: verdictFor(score),
    token: { name, symbol, decimals, totalSupply },
    liquidityBNB,
    ownerRenounced,
    isProxy,
    riskyFunctions,
    signals,
  };
}
