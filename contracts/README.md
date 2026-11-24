# Levium contracts (Foundry)

On-chain verification for Levium "AI with a receipt". BNB Smart Chain **mainnet only** (chainId 56).
Not deployed yet.

| Contract | Purpose |
| --- | --- |
| `src/LeviumRegistry.sol` | Owner-managed registry of AI models (`modelId → fingerprint, name, active`) and trusted attestation signers. Two-step ownership. `TREASURY = 0x7d6b84648Fe791b2a2623b8B4D6fbB00ce7daB76`. |
| `src/LeviumVerifier.sol` | `verifyReceipt(...) → (valid, signer)` and `anchor(...)` (emits `ReceiptAnchored`, one anchor per receipt). |
| `src/LeviumJudgeEscrow.sol` | Example consumer: two-party BNB wager paid out to the winner named by a verified Levium receipt. |
| `script/Deploy.s.sol` | Deploys registry + verifier and trusts `SIGNER_ADDRESS`. Refuses to run on any chain other than 56. |

## Receipt verification (matches `../SPEC.md`)

```
receiptHash = keccak256(abi.encode(bytes32 modelFingerprint, bytes32 inputHash, bytes32 outputHash,
                                   uint256 chainId /* block.chainid = 56 */, uint256 blockNumber, uint256 timestamp))
digest      = keccak256("\x19Ethereum Signed Message:\n32" ‖ receiptHash)   // ethers signMessage(getBytes(receiptHash))
```

A receipt is valid when the signature is exactly 65 bytes (`r ‖ s ‖ v`), `v ∈ {27, 28}`, `s` is in the lower half of the
curve order (no malleable twins), the recovered signer is trusted in the registry, and `modelFingerprint` belongs to an
active registered model. `verifyReceipt` never reverts on bad input; it returns `(false, recoveredOrZero)`.

## Escrow winner convention (example only)

The judge model's `outputHash` must equal
`winnerCommitment(matchId, winner) = keccak256(abi.encode(escrowAddress, block.chainid, matchId, winner))`, and the
receipt's `modelFingerprint` and `inputHash` must match the ones fixed when the match was created.

## Build and test

```sh
forge build
forge test -vv
```

## Deploy to BNB Smart Chain mainnet (later, once funded)

```sh
cp .env.example .env    # fill PRIVATE_KEY, SIGNER_ADDRESS, BSCSCAN_API_KEY
source .env
forge script script/Deploy.s.sol --rpc-url bsc --broadcast --verify
```

Run it without `--broadcast` first to simulate against mainnet. After deploying, register models with
`registry.registerModel(keccak256("rugscan-v1"), <fingerprint>, "rugscan-v1")` and consider moving ownership to a
multisig via `transferOwnership` + `acceptOwnership`.
