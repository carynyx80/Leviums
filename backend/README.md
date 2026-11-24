# Levium backend

Node 22 + Express + ethers v6. Issues signed, hash-committed receipts for deterministic models evaluated against BNB Smart Chain **mainnet** (chainId 56). See `../SPEC.md` for the receipt format and API.

## Run

```bash
npm install
npm start            # listens on $PORT (default 8080), host 0.0.0.0
```

## Environment variables

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8080` | Set automatically on Railway |
| `SIGNER_PRIVATE_KEY` | random | Attestation key. If unset, an ephemeral key is generated and a WARNING with only its address is logged. **Set this in production**, otherwise receipts stop verifying as trusted after every restart. |
| `BSC_RPC_URL` | `https://bsc-dataseed.binance.org` | Primary RPC. Fallbacks `https://bsc-rpc.publicnode.com` and `https://bsc-dataseed1.defibit.io` are tried in order on failure. Startup fails if an RPC reports a chainId other than 56. |
| `TREASURY_ADDRESS` | `0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76` | Anchor txs must be sent here |
| `DATA_DIR` | `./data` | `receipts.json` is loaded on boot and rewritten on every new receipt/anchor. On Railway, mount a volume here or receipts are lost on redeploy. |

Copy `.env.example` as a reference (env vars are read from the process environment; no dotenv loader).

## Notes

- `modelFingerprint` = `0x` + sha256 of the model's source file (`src/models/*.js`), so editing a model changes its fingerprint.
- Models read chain state at `head - 3` (the receipt's `blockNumber`) with `blockTag`, so the output is reproducible from that block.
- `POST /v1/ask` is rate limited to 30 requests/min per IP (in memory).
- `/v1/stats` returns `models` as the number of models, plus `modelCounts` (receipts per model).
