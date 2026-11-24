// walletscan-v1 — deterministic wallet profile from on-chain state at a fixed block.
// Changing this file changes the model fingerprint (sha256 of this source).
import { formatEther } from "ethers";
import { requireAddress, clamp, verdictFor, round } from "./util.js";

export const meta = {
  id: "walletscan-v1",
  name: "WalletScan",
  version: "1.0.0",
  description: "Deterministic wallet profile: BNB balance, transaction count and contract detection at a fixed mainnet block.",
  inputSchema: { address: "address" },
  kind: "deterministic",
};

export function validateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("input must be an object"), { status: 400, noRetry: true });
  return { address: requireAddress(input.address, "address") };
}

export async function run({ address }, { provider, blockNumber }) {
  const blockTag = blockNumber;
  const [balance, txCount, code] = await Promise.all([
    provider.getBalance(address, blockTag),
    provider.getTransactionCount(address, blockTag),
    provider.getCode(address, blockTag),
  ]);
  const isContract = !!code && code !== "0x";
  const balanceBNB = round(formatEther(balance), 6);
  const signals = [];
  const sig = (label, severity, detail) => signals.push({ label, severity, detail });
  let score = 40;

  if (isContract) {
    sig("Smart contract", "warn", "Address holds bytecode — it is a contract, not an EOA.");
  } else {
    sig("Externally owned account", "good", "No bytecode at this address.");
  }

  if (balance === 0n) {
    score -= 10;
    sig("Empty balance", "warn", "0 BNB held.");
  } else if (balanceBNB >= 1) {
    score += 20;
    sig("Funded wallet", "good", `${balanceBNB} BNB held.`);
  } else {
    score += 10;
    sig("Small balance", "good", `${balanceBNB} BNB held.`);
  }

  if (!isContract) {
    if (txCount === 0) {
      score -= 20;
      sig("No outgoing transactions", "bad", "Nonce is 0 — fresh or unused wallet.");
    } else if (txCount >= 1000) {
      score += 40;
      sig("Very active wallet", "good", `${txCount} transactions sent.`);
    } else if (txCount >= 100) {
      score += 30;
      sig("Active wallet", "good", `${txCount} transactions sent.`);
    } else if (txCount >= 10) {
      score += 20;
      sig("Some history", "good", `${txCount} transactions sent.`);
    } else {
      score += 5;
      sig("Limited history", "warn", `Only ${txCount} transactions sent.`);
    }
  } else {
    sig("Contract nonce", "warn", `Contract nonce ${txCount} (contracts created).`);
  }

  score = clamp(score);
  return { score, verdict: verdictFor(score), balanceBNB, txCount, isContract, signals };
}
