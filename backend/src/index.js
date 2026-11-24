import express from "express";
import cors from "cors";
import { Wallet, isHexString } from "ethers";
import { CHAIN_ID, TREASURY, PORT, RPC_URLS } from "./config.js";
import { withProvider, assertMainnet, getCachedBlockNumber } from "./chain.js";
import { buildReceipt, verifyReceipt } from "./receipt.js";
import { loadStore, saveReceipt, getReceipt, feed, stats } from "./store.js";
import { models, listModels } from "./models/index.js";

// ---- Signer ----
let wallet;
const pk = (process.env.SIGNER_PRIVATE_KEY || "").trim();
if (pk) {
  try {
    wallet = new Wallet(pk.startsWith("0x") ? pk : "0x" + pk);
  } catch {
    console.error("FATAL: SIGNER_PRIVATE_KEY is not a valid private key");
    process.exit(1);
  }
} else {
  wallet = Wallet.createRandom();
  console.warn(`WARNING: SIGNER_PRIVATE_KEY not set — using an ephemeral random attestation key (address ${wallet.address}). Receipts will not verify as trusted after restart.`);
}

const startedAt = Date.now();
const BLOCK_SAFETY_LAG = 3; // analyse a few blocks behind head so load-balanced RPC nodes all have the state

// ---- App ----
const app = express();
app.set("trust proxy", true);
app.use(cors());
app.use(express.json({ limit: "256kb" }));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Simple in-memory per-IP rate limiter
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (now - h.start > windowMs) hits.delete(ip);
  }, windowMs).unref();
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || now - h.start > windowMs) {
      h = { start: now, count: 0 };
      hits.set(ip, h);
    }
    h.count++;
    if (h.count > max) {
      res.set("Retry-After", String(Math.ceil((h.start + windowMs - now) / 1000)));
      return res.status(429).json({ error: "Rate limit exceeded, try again shortly" });
    }
    next();
  };
}

app.get("/", (req, res) => res.json({ name: "levium-backend", ok: true }));

app.get(
  "/health",
  wrap(async (req, res) => {
    let blockNumber = null;
    try {
      blockNumber = await getCachedBlockNumber();
    } catch {}
    res.json({ ok: blockNumber !== null, chainId: CHAIN_ID, signer: wallet.address, treasury: TREASURY, blockNumber });
  })
);

app.get("/v1/models", (req, res) => res.json(listModels()));

app.post(
  "/v1/ask",
  rateLimit({ windowMs: 60_000, max: 30 }),
  wrap(async (req, res) => {
    const body = req.body || {};
    const model = models.get(typeof body.model === "string" ? body.model : "");
    if (!model) throw new HttpError(400, `Unknown model. Available: ${[...models.keys()].join(", ")}`);
    const input = model.validateInput(body.input);

    const { output, blockNumber } = await withProvider(async (provider) => {
      const head = await provider.getBlockNumber();
      const blockNumber = Math.max(0, head - BLOCK_SAFETY_LAG);
      const output = await model.run(input, { provider, blockNumber });
      return { output, blockNumber };
    }, { timeoutMs: 25000 });

    const receipt = await buildReceipt({
      wallet,
      model: model.meta.id,
      modelFingerprint: model.fingerprint,
      input,
      output,
      chainId: CHAIN_ID,
      blockNumber,
      timestamp: Math.floor(Date.now() / 1000),
    });
    saveReceipt(receipt);
    res.json(receipt);
  })
);

app.get("/v1/receipts/:id", (req, res) => {
  const r = getReceipt(req.params.id);
  if (!r) return res.status(404).json({ error: "Receipt not found" });
  res.json(r);
});

app.post("/v1/verify", (req, res) => {
  const receipt = req.body?.receipt;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt))
    return res.status(400).json({ error: "Body must be { receipt: {...} }" });
  res.json(verifyReceipt(receipt, wallet.address));
});

app.post(
  "/v1/anchor",
  wrap(async (req, res) => {
    const { receiptId, txHash } = req.body || {};
    if (typeof receiptId !== "string" || !isHexString(receiptId, 32)) throw new HttpError(400, "receiptId must be a 0x-prefixed 32-byte hex string");
    if (typeof txHash !== "string" || !isHexString(txHash, 32)) throw new HttpError(400, "txHash must be a 0x-prefixed 32-byte hex string");
    const receipt = getReceipt(receiptId);
    if (!receipt) throw new HttpError(404, "Receipt not found");
    if (receipt.anchor) {
      if (receipt.anchor.txHash.toLowerCase() === txHash.toLowerCase()) return res.json(receipt);
      throw new HttpError(409, `Receipt already anchored by ${receipt.anchor.txHash}`);
    }

    const result = await withProvider(async (provider) => {
      let tx = await provider.getTransaction(txHash);
      let txr = await provider.getTransactionReceipt(txHash);
      if (!txr) {
        try {
          txr = await provider.waitForTransaction(txHash, 1, 30_000);
        } catch {
          txr = null;
        }
        if (!tx) tx = await provider.getTransaction(txHash);
      }
      return { tx, txr };
    }, { timeoutMs: 40_000 });

    const { tx, txr } = result;
    if (!tx && !txr) throw new HttpError(409, "pending: transaction not found on BSC mainnet yet — retry shortly");
    if (!txr) throw new HttpError(409, "pending: transaction not yet mined — retry shortly");
    if (!tx) throw new HttpError(502, "Could not fetch transaction details");
    if (txr.status !== 1) throw new HttpError(422, "Transaction failed (status 0)");
    if (tx.chainId !== BigInt(CHAIN_ID)) throw new HttpError(422, `Transaction chainId ${tx.chainId} is not ${CHAIN_ID}`);
    if (!tx.to || tx.to.toLowerCase() !== TREASURY.toLowerCase()) throw new HttpError(422, `Transaction recipient must be the treasury ${TREASURY}`);
    if ((tx.data || "").toLowerCase() !== receipt.id.toLowerCase()) throw new HttpError(422, "Transaction data does not equal the receiptId");

    receipt.anchor = { txHash: txr.hash, blockNumber: txr.blockNumber, from: tx.from };
    saveReceipt(receipt);
    res.json(receipt);
  })
);

app.get("/v1/feed", (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  res.json(feed(Math.min(limit, 100)));
});

app.get("/v1/stats", (req, res) => {
  const s = stats();
  res.json({ ...s, models: models.size, modelCounts: s.models, signer: wallet.address, uptimeSec: Math.floor((Date.now() - startedAt) / 1000) });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error("[error]", err?.stack || err);
  res.status(status).json({ error: status >= 500 && !err?.status ? "Internal server error" : err.message });
});

process.on("unhandledRejection", (e) => console.error("[unhandledRejection]", e));

// ---- Boot ----
const loaded = loadStore();
try {
  const n = await assertMainnet();
  console.log(`[chain] BSC mainnet (chainId 56) confirmed on ${n}/${RPC_URLS.length} RPC endpoints`);
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[levium] listening on 0.0.0.0:${PORT} | signer ${wallet.address} | treasury ${TREASURY} | ${loaded} receipts loaded`);
  for (const m of listModels()) console.log(`[model] ${m.id} fingerprint ${m.fingerprint}`);
});
