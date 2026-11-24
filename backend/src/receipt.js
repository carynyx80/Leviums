import { keccak256, toUtf8Bytes, AbiCoder, getBytes, verifyMessage, getAddress, isHexString } from "ethers";

/** Deterministic JSON: sorted object keys, BigInt -> string, undefined/functions dropped. */
export function stableStringify(value) {
  if (value === null) return "null";
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((v) => (v === undefined || typeof v === "function" ? "null" : stableStringify(v))).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      const v = value[k];
      if (v === undefined || typeof v === "function") continue;
      parts.push(JSON.stringify(k) + ":" + stableStringify(v));
    }
    return "{" + parts.join(",") + "}";
  }
  return "null";
}

/** Deep-convert BigInt to string so stored/returned JSON matches hashed JSON. */
export function normalize(value) {
  return JSON.parse(stableStringify(value));
}

export const hashJson = (obj) => keccak256(toUtf8Bytes(stableStringify(obj)));

const coder = AbiCoder.defaultAbiCoder();
export function computeReceiptHash({ modelFingerprint, inputHash, outputHash, chainId, blockNumber, timestamp }) {
  return keccak256(
    coder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "uint256", "uint256"],
      [modelFingerprint, inputHash, outputHash, BigInt(chainId), BigInt(blockNumber), BigInt(timestamp)]
    )
  );
}

export async function buildReceipt({ wallet, model, modelFingerprint, input, output, chainId, blockNumber, timestamp }) {
  const nInput = normalize(input);
  const nOutput = normalize(output);
  const inputHash = hashJson(nInput);
  const outputHash = hashJson(nOutput);
  const receiptHash = computeReceiptHash({ modelFingerprint, inputHash, outputHash, chainId, blockNumber, timestamp });
  const signature = await wallet.signMessage(getBytes(receiptHash));
  return {
    id: receiptHash,
    model,
    modelFingerprint,
    input: nInput,
    inputHash,
    output: nOutput,
    outputHash,
    chainId,
    blockNumber,
    timestamp,
    receiptHash,
    signer: wallet.address,
    signature,
    tier: "attested",
    anchor: null,
  };
}

const isBytes32 = (v) => typeof v === "string" && isHexString(v, 32);
const isUint = (v) =>
  (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) || (typeof v === "string" && /^[0-9]+$/.test(v));

export function verifyReceipt(r, trustedSigner) {
  const checks = [];
  const add = (label, ok) => checks.push({ label, ok: !!ok });
  let recoveredSigner = null;
  let inputOk = false, outputOk = false, receiptOk = false;

  if (!r || typeof r !== "object" || Array.isArray(r)) {
    add("Receipt is an object", false);
    return { valid: false, recoveredSigner, trustedSigner, hashesMatch: false, checks };
  }

  const wellFormed =
    isBytes32(r.modelFingerprint) && isBytes32(r.inputHash) && isBytes32(r.outputHash) && isBytes32(r.receiptHash) &&
    isUint(r.chainId) && isUint(r.blockNumber) && isUint(r.timestamp) &&
    typeof r.signature === "string" && "input" in r && "output" in r;
  add("Receipt fields well-formed", wellFormed);

  try {
    inputOk = hashJson(r.input) === String(r.inputHash).toLowerCase();
  } catch {}
  add("inputHash matches keccak256(stableStringify(input))", inputOk);
  try {
    outputOk = hashJson(r.output) === String(r.outputHash).toLowerCase();
  } catch {}
  add("outputHash matches keccak256(stableStringify(output))", outputOk);

  let recomputed = null;
  try {
    recomputed = computeReceiptHash({
      modelFingerprint: r.modelFingerprint,
      inputHash: hashJson(r.input),
      outputHash: hashJson(r.output),
      chainId: r.chainId,
      blockNumber: r.blockNumber,
      timestamp: r.timestamp,
    });
    receiptOk = recomputed === String(r.receiptHash).toLowerCase();
  } catch {}
  add("receiptHash matches recomputed abi.encode hash", receiptOk);
  add("id equals receiptHash", typeof r.id === "string" && typeof r.receiptHash === "string" && r.id.toLowerCase() === r.receiptHash.toLowerCase());
  add("chainId is 56 (BNB Smart Chain mainnet)", Number(r.chainId) === 56);

  try {
    recoveredSigner = verifyMessage(getBytes(r.receiptHash), r.signature);
  } catch {
    recoveredSigner = null;
  }
  add("Signature is valid EIP-191 signature over receiptHash", !!recoveredSigner);
  let declared = null;
  try { declared = getAddress(r.signer); } catch {}
  add("Recovered signer equals receipt.signer", !!recoveredSigner && recoveredSigner === declared);
  add("Signer is this node's trusted attestation key", !!recoveredSigner && recoveredSigner === trustedSigner);

  const hashesMatch = inputOk && outputOk && receiptOk;
  const valid = checks.every((c) => c.ok);
  return { valid, recoveredSigner, trustedSigner, hashesMatch, checks };
}
