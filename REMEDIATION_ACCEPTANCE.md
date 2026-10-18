# Financial Remediation & Live Acceptance Evidence

Date: 2026-10-18  
Source commit: `6d7c0fc` (`fix: harden cross-chain settlement and custody`)

## Current matched deployment

| Component | Address / identity |
| --- | --- |
| GenLayer StudioNet Intelligent Contract | `0x2810D77Eb436054d843431A76f5F7883Bc8E6927` |
| Base Sepolia escrow | `0x92078A23863aE5D79594B3F517B44F295cc494a6` |
| Base Sepolia test USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Relayer / E2E wallet | `0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb` |
| Independent settlement authority | `0x54351E55350f5414C6a5e2d54Cb9d1fECE3107C9` |

Deployment transactions:

- GenLayer deployment: `0xdee8aafc29d2ac338fe6596ab94f206a72eb142454d85cb885dee1653c5aac36`; finalized `ACCEPTED`, `MAJORITY_AGREE`, 3 AGREE / 2 IDLE, leader GenVM execution `SUCCESS`.
- Base escrow deployment: [`0x9b69e345cc9dde6625f408c4678de73b27abb1e5b2135ed2e5df0bcbf372b539`](https://sepolia.basescan.org/tx/0x9b69e345cc9dde6625f408c4678de73b27abb1e5b2135ed2e5df0bcbf372b539).

## Complete live transaction sequence

The live market was "Remediation E2E: Bitcoin chronology". It required the Bitcoin genesis block (2009-01-03) to precede the first halving (2012-11-28).

1. Market creation: GenLayer tx `0xd24ef49511a09afd2068a8ae459f315efdb114d2f2c1149e3c556a5ddffaeeb7`; `ACCEPTED`, unanimous 5/5 AGREE.
2. USDC approval: [`0x97550ff5d25f2b1c98bda743d62a487e2291e2847d20b9c5a96758e9703f0d64`](https://sepolia.basescan.org/tx/0x97550ff5d25f2b1c98bda743d62a487e2291e2847d20b9c5a96758e9703f0d64).
3. 1.000000 USDC deposit: [`0x23058b339b07a082411a665646717dcc06e1866ae63243ba0b4e74e2b60d169b`](https://sepolia.basescan.org/tx/0x23058b339b07a082411a665646717dcc06e1866ae63243ba0b4e74e2b60d169b), `Staked` log index 66, deposit id `0x23058b...d169b:66`.
4. GenLayer stake recording: `0x979fabb18a7684e931a55f6f917a582f7df036b686cd4017ec3b1f1610a1c595`; `ACCEPTED`, 4 AGREE / 1 IDLE, leader GenVM execution `SUCCESS`.
5. Validator adjudication: `0x09db4b46b9ffc261abe31cd15468617cd7572e856336a302cb1c1bd0b20d3e50`; finalized `RESOLVED_YES`, `MAJORITY_AGREE`, 3 AGREE / 1 DISAGREE / 1 IDLE. Step 1 was fulfilled at 100% confidence with `occurred_at_ts=1230940800`; step 2 at 95% with `occurred_at_ts=1354060800`, proving the required chronology.
6. Authority-bound Base settlement: [`0x53a913525e6f81ad30f8fb7d9ca210ab8027a04a510de7698b66998dd287bb07`](https://sepolia.basescan.org/tx/0x53a913525e6f81ad30f8fb7d9ca210ab8027a04a510de7698b66998dd287bb07). The signed commitment binds chain id, escrow, market id, full recipient/amount hash, GenLayer verdict tx hash, and deposited pool size.
7. Recipient withdrawal: [`0x4e95b09bbb407718cf1959e06f8ead2f602f070c2b5c87d8f9b2f76845c2086d`](https://sepolia.basescan.org/tx/0x4e95b09bbb407718cf1959e06f8ead2f602f070c2b5c87d8f9b2f76845c2086d). Wallet USDC changed from `119500000` to `120500000` base units: exactly +1.000000 USDC. Claimable changed from `1000000` to `0`.

## Corrections mapped to findings

- **Custody:** the unsafe `withdrawUnallocated` function no longer exists. Active pools cannot be withdrawn. Post-settlement surplus requires an independent, nonce-bound authority signature and cannot consume `allocated` user entitlements.
- **Settlement authentication:** `settle` verifies the independent authority signature over the complete payout and finalized-verdict commitment. A relayer cannot change a recipient, amount, market, verdict, pool size, chain, or escrow address.
- **Late finality:** `allocateLateRefund` is independently signed, deposit-idempotent, increases protected allocation, and works after the one-time settlement. The relay queries GenLayer's deposit-specific `is_stake_late` state and retries safely.
- **Event identity:** the relay, PostgreSQL primary key, API, and GenLayer idempotency map all use `txHash:logIndex`. The migration preserves legacy rows as log index 0.
- **Empty winning side:** every participant receives principal back and no fee accrues; terminal payouts are never left empty when funded positions exist.
- **Fee snapshot:** protocol and creator basis points are copied into each market at creation and every quote, claim, payout, and accrual uses that snapshot.
- **Chronology:** validators return an evidence-backed `occurred_at_ts`; later steps are rejected with a deterministic chronology violation when their event time is not strictly later.

## Reproducible verification

- `pytest -q tests/direct`: **38 passed**.
- `forge test --match-path test/EventWeaverEscrow.t.sol`: **5 passed**.
- `cd backend && npm test`: **1 passed**.
- `genvm-lint lint contracts/event_weaver.py`: **3 checks passed**.
- `cd frontend && npm run build`: successful production build.

The Solidity suite covers active-custody withdrawal resistance, altered-relayer allocations, settlement without authority verdict, post-settlement late refunds and same-transaction multiple stake logs. Direct GenLayer tests cover fee snapshots, empty-winning-side refunds, contradictory real-world chronology, SDK-decoded addresses, and `txHash:logIndex` idempotency.
