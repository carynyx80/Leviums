# Levium — Verifiable AI on BNB Chain (mainnet only)

"AI with a receipt": every AI answer comes with a signed, hash-committed receipt anyone can verify, and anyone can anchor on BNB mainnet.

- Chain: BNB Smart Chain mainnet, chainId 56. NO testnet anywhere.
- Public RPC: https://bsc-dataseed.binance.org (fallbacks: https://bsc-dataseed1.defibit.io, https://bsc-rpc.publicnode.com)
- Company / treasury wallet: 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76
- PancakeSwap V2 factory: 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73 ; WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

Repo layout: `frontend/` (Vite+React, Vercel), `backend/` (Node 22 Express, Railway), `contracts/` (Foundry, not deployed yet — no gas funds).

## Receipt (shared format)
```
{
  id: "0x..",               // = receiptHash
  model: "rugscan-v1",
  modelFingerprint: "0x..", // sha256 of model source/config, bytes32
  input: {...}, inputHash: "0x..",   // keccak256(utf8(stableStringify(input)))
  output: {...}, outputHash: "0x..", // keccak256(utf8(stableStringify(output)))
  chainId: 56, blockNumber: 123, timestamp: 1700000000,
  receiptHash: "0x..",      // keccak256(abi.encode(bytes32 modelFingerprint, bytes32 inputHash, bytes32 outputHash, uint256 chainId, uint256 blockNumber, uint256 timestamp))
  signer: "0x..",           // node attestation key address
  signature: "0x..",        // EIP-191 personal_sign over the 32-byte receiptHash (signMessage(getBytes(receiptHash)))
  tier: "attested",         // attested | challengeable | zk (only attested is live)
  anchor: null | { txHash, blockNumber, from }
}
```

## Backend API (base URL = VITE_API_URL)
- GET  /health → { ok, chainId:56, signer, treasury, blockNumber }
- GET  /v1/models → [{ id, name, version, description, fingerprint, inputSchema: {field: type}, kind:"deterministic" }]
- POST /v1/ask { model, input, requester? } → Receipt
  - rugscan-v1: input { token: address } → output { score 0-100 (higher = safer), verdict: "SAFE"|"CAUTION"|"DANGER", token:{name,symbol,decimals,totalSupply}, liquidityBNB, ownerRenounced, signals:[{label, severity:"good"|"warn"|"bad", detail}] }
  - walletscan-v1: input { address } → output { score, verdict, balanceBNB, txCount, isContract, signals:[...] }
- GET  /v1/receipts/:id → Receipt
- POST /v1/verify { receipt } → { valid, recoveredSigner, trustedSigner, hashesMatch, checks:[{label, ok}] }
- POST /v1/anchor { receiptId, txHash } → verifies on mainnet that tx.to == treasury and tx.input == receiptId; stores anchor; returns Receipt
- GET  /v1/feed?limit=20 → Receipt[] newest first
- GET  /v1/stats → { totalReceipts, anchored, models, signer, uptimeSec }

## On-chain anchor (works today, no contract needed)
User's wallet sends a 0-BNB tx on chainId 56: `{ to: TREASURY, value: 0, data: receiptId }`. Backend verifies via POST /v1/anchor.
