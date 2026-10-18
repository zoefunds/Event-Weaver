# Financial Remediation & Live Acceptance Evidence

Date: 2026-10-18  
Source commits: `6d7c0fc` (financial hardening) and `86ed043` (mandatory event-time validation). Canonical public branch: `main`.

## Current matched deployment

| Component | Address / identity |
| --- | --- |
| GenLayer StudioNet Intelligent Contract | `0x9E9Ef1bC5d4436C62Bc2847Ae0a4bb3DeAd91B8F` |
| Base Sepolia escrow | `0xF53f14aAed565BfA276598e02943DFed69217705` |
| Base Sepolia test USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Relayer / E2E wallet | `0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb` |
| Independent settlement authority | `0x54351E55350f5414C6a5e2d54Cb9d1fECE3107C9` |

Deployment transactions:

- GenLayer deployment: `0x2014c19dab266249099cab8c5a92628298fe18c537349a4a140674747716dcb5`; finalized `ACCEPTED`, `MAJORITY_AGREE`, unanimous 5/5 AGREE, leader GenVM execution `SUCCESS`.
- Base escrow deployment: [`0xa94f7df17b7ae0eb9ca6c55e0fc3c472c8636e57ee5ba91d340d7e9e16328859`](https://sepolia.basescan.org/tx/0xa94f7df17b7ae0eb9ca6c55e0fc3c472c8636e57ee5ba91d340d7e9e16328859).

## Complete live transaction sequence

The live market was "Final E2E: Bitcoin chronology". It required the Bitcoin genesis block (2009-01-03) to precede the first halving (2012-11-28).

1. Market creation: GenLayer tx `0x6789f02287c8efef038420a6f6367b40ff1d1662c4d7115b0dd320e1806187b8`; `ACCEPTED`, 3 AGREE / 2 IDLE.
2. USDC approval: [`0x28cf65c1fa29a72e96c24547205e31a5a25f0fafcbcd4a74a998c660d8c0f142`](https://sepolia.basescan.org/tx/0x28cf65c1fa29a72e96c24547205e31a5a25f0fafcbcd4a74a998c660d8c0f142).
3. 0.100000 USDC deposit: [`0x97207761e1cadf26ac6bb142bc89ea4a8322508069357f6443577c6b625daede`](https://sepolia.basescan.org/tx/0x97207761e1cadf26ac6bb142bc89ea4a8322508069357f6443577c6b625daede), `Staked` log index 8, deposit id `0x972077...daede:8`.
4. GenLayer stake recording: `0xe02caf6b91dace91ce0b719b8f62dc713ff2c56bf4bc4d5fb262763369785744`; `ACCEPTED`, 3 AGREE / 2 IDLE, leader GenVM execution `SUCCESS`.
5. Validator adjudication: `0xdd239609b829fe66c62fada29d8c189a79ea6b2e2b754f465ac7b2a6701dfb3e`; finalized `RESOLVED_YES`, `MAJORITY_AGREE`, 3 AGREE / 2 IDLE in the final round. Both steps were fulfilled at 100% confidence with `occurred_at_ts=1230940800` then `1354060800`, proving the required chronology.
6. Authority-bound Base settlement: [`0xcf48e07a7119258c88746c5d5d975bf4f62c996cefe96ddcd3519893bd66dc7c`](https://sepolia.basescan.org/tx/0xcf48e07a7119258c88746c5d5d975bf4f62c996cefe96ddcd3519893bd66dc7c). The signed commitment binds chain id, escrow, market id, full recipient/amount hash, GenLayer verdict tx hash, and deposited pool size.
7. Recipient withdrawal: [`0x232d07e711c92ad6368b0f18d325d8f45d38496f29af23028fce6ef339a7983a`](https://sepolia.basescan.org/tx/0x232d07e711c92ad6368b0f18d325d8f45d38496f29af23028fce6ef339a7983a). Wallet USDC changed from `121400000` to `121500000` base units: exactly +0.100000 USDC. Claimable changed from `100000` to `0`.

## Corrections mapped to findings

- **Custody:** the unsafe `withdrawUnallocated` function no longer exists. Active pools cannot be withdrawn. Post-settlement surplus requires an independent, nonce-bound authority signature and cannot consume `allocated` user entitlements.
- **Settlement authentication:** `settle` verifies the independent authority signature over the complete payout and finalized-verdict commitment. A relayer cannot change a recipient, amount, market, verdict, pool size, chain, or escrow address.
- **Late finality:** `allocateLateRefund` is independently signed, deposit-idempotent, increases protected allocation, and works after the one-time settlement. The relay queries GenLayer's deposit-specific `is_stake_late` state and retries safely.
- **Event identity:** the relay, PostgreSQL primary key, API, and GenLayer idempotency map all use `txHash:logIndex`. The migration preserves legacy rows as log index 0.
- **Empty winning side:** every participant receives principal back and no fee accrues; terminal payouts are never left empty when funded positions exist.
- **Fee snapshot:** protocol and creator basis points are copied into each market at creation and every quote, claim, payout, and accrual uses that snapshot.
- **Chronology:** validators return an evidence-backed `occurred_at_ts`; later steps are rejected with a deterministic chronology violation when their event time is not strictly later.

## Reproducible verification

- `pytest -q tests/direct`: **40 passed**.
- `forge test --match-path test/EventWeaverEscrow.t.sol`: **5 passed**.
- `cd backend && npm test`: **1 passed**.
- `genvm-lint lint contracts/event_weaver.py`: **3 checks passed**.
- `cd frontend && npm run build`: successful production build.

Production verification on 2026-10-18 confirmed both Fly machines healthy, `/health` and
`/api/config` reporting the canonical GenLayer contract, production CORS accepting the Vercel
origin, and the deployed Vercel bundle containing the canonical API, GenLayer, escrow and USDC
values with no superseded contract address.

The Solidity suite covers active-custody withdrawal resistance, altered-relayer allocations, settlement without authority verdict, post-settlement late refunds and same-transaction multiple stake logs. Direct GenLayer tests cover fee snapshots, empty-winning-side refunds, contradictory real-world chronology, SDK-decoded addresses, and `txHash:logIndex` idempotency.
