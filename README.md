# Levium — AI with a receipt

Verifiable AI on BNB Chain (mainnet only). Every AI answer comes with a signed, hash-committed receipt anyone can verify and anchor on BNB mainnet.

- Website: https://www.keelcode.xyz
- API: https://api.keelcode.xyz (`/health`, `/v1/models`, `/v1/ask`, `/v1/verify`, `/v1/anchor`, `/v1/feed`, `/v1/stats`)
- Treasury: [0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76](https://bscscan.com/address/0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76)

| Folder | What | Hosted |
|---|---|---|
| `frontend/` | Vite + React site, wallet connect (wagmi, BNB chainId 56) | Vercel |
| `backend/` | Node/Express receipt API | Railway |
| `contracts/` | Foundry: registry, verifier, judge escrow (not deployed yet) | — |

See `SPEC.md` for the receipt format.
