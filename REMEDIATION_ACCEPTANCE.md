# Financial Remediation and Live Acceptance Evidence

Date: 2026-10-18. Canonical branch: `main`. This record covers the second financial,
cross-chain recovery, chronology-consensus, and deployment-consistency remediation.

## Canonical matched deployment

| Component | Address / identity |
| --- | --- |
| GenLayer StudioNet contract | `0x3b1781e005AEEf7ec64A51a8DFA323A16aAa0a6f` |
| Base Sepolia escrow | [`0xd1c6864eCE3f06B1a18932905ab816635726040c`](https://sepolia.basescan.org/address/0xd1c6864eCE3f06B1a18932905ab816635726040c) |
| Base Sepolia test USDC | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| Relayer / deployment wallet | `0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb` |
| Independent settlement authority | `0xb26B9762edc49f261Ad9fF26FeF0AD6c43930D01` |
| Backend | [eventweaver-api-v2.fly.dev](https://eventweaver-api-v2.fly.dev) |
| Frontend | [eventweaver-orpin.vercel.app](https://eventweaver-orpin.vercel.app) |

The escrow constructor permanently binds the USDC token, relayer, independent authority,
and canonical GenLayer contract. Financial roles are immutable. Its deployment block is `48280044`.

Deployment evidence:

- GenLayer deployment `0x91820667c008afd59e91aebd5bdd23b1d0623d9024f8c988d2efe70aa22d5f15`:
  `ACCEPTED`, `MAJORITY_AGREE`, five commits, five reveals, and five AGREE votes; every GenVM
  execution receipt reported `SUCCESS`.
- Base deployment [`0x364e2d5b206d0be499cc07e6ef96775d58b425ecc0b48f313780399624230729`](https://sepolia.basescan.org/tx/0x364e2d5b206d0be499cc07e6ef96775d58b425ecc0b48f313780399624230729).
- Vercel production deployment `dpl_5oJ2QTmL35o3zVskAbRpBoFftoti` is aliased to the
  public frontend. Public backend `/health` and `/api/config` report the same GenLayer address.
- The authority runs as a separate Fly application. The backend contains no authority private
  key; it has only a private service URL and bearer token. The obsolete backend key secret was removed.

## Historical live YES outcome with losing-pool distribution

This completed value-transfer sequence belongs to the preceding, retired matched pair. It is
retained as historical evidence; it must not be read as activity on the immutable pair above.

Market 0 verifies the Bitcoin genesis-to-first-halving chronology.

1. Creation: GenLayer `0xfcebdee911689807c85d5bea8a0439800902508e724a165a06bb237b6ea9ef40`,
   accepted with five validator commitments and reveals.
2. Authenticated Base registration: [`0x9306f301a6288a356c66a09d8eb94600b732d6d22e0211e22c59383b237cf8c0`](https://sepolia.basescan.org/tx/0x9306f301a6288a356c66a09d8eb94600b732d6d22e0211e22c59383b237cf8c0).
3. YES 0.200000 USDC: [`0xf128b0ff69204c5c5709eb24c1f1b2f371cfbbb3ae14b1977b872219708e4c18`](https://sepolia.basescan.org/tx/0xf128b0ff69204c5c5709eb24c1f1b2f371cfbbb3ae14b1977b872219708e4c18),
   log index 47, deposit id `txHash:47`.
4. NO 0.100000 USDC from a distinct wallet:
   [`0x41548069976a5dbff011e9cbe962c760240ba8361b9b9d343732676ec1ba8973`](https://sepolia.basescan.org/tx/0x41548069976a5dbff011e9cbe962c760240ba8361b9b9d343732676ec1ba8973),
   log index 82, deposit id `txHash:82`.
5. Base acknowledgements after successful GenLayer registration:
   [`0xd6f0ce787958eed2702a1bf473bb8852312b4c7312adb2d9625f8345a2823dd9`](https://sepolia.basescan.org/tx/0xd6f0ce787958eed2702a1bf473bb8852312b4c7312adb2d9625f8345a2823dd9)
   and [`0x0f38e5ef934c476432ca5d319fb4508ebe8d2df739a67d636a0c88270238a7bb`](https://sepolia.basescan.org/tx/0x0f38e5ef934c476432ca5d319fb4508ebe8d2df739a67d636a0c88270238a7bb).
   Pool state before adjudication was deposited `300000`, pending `0`.
6. Adjudication: GenLayer `0x7cec0352a6e67a5f18510c2b3d187fb8f45e48c2ae67868148493468e89f9796`,
   `MAJORITY_AGREE`, five commits/reveals. Result `RESOLVED_YES`; both events were verified at
   UTC dates 2009-01-03 and 2012-11-28 with 100% confidence.
7. Canonical payout: 0.298500 USDC to the YES wallet. Authority-signed Base settlement:
   [`0xccfe354fd476706dd2f9e0afad9739eccddaa94f466730bde30dd3e239a76ddd`](https://sepolia.basescan.org/tx/0xccfe354fd476706dd2f9e0afad9739eccddaa94f466730bde30dd3e239a76ddd).
8. Withdrawal: [`0xb6ba6a82a0ec2daadfa0163cc026cc0ad46867b0b0a7c82e955d8483b260f9be`](https://sepolia.basescan.org/tx/0xb6ba6a82a0ec2daadfa0163cc026cc0ad46867b0b0a7c82e955d8483b260f9be).
   Recipient balance changed from `121.100000` to `121.398500` USDC; claimable changed from
   `0.298500` to zero.

## Historical live NO outcome

Market 1 deliberately asserted the false date 4 January 2009 for the Bitcoin genesis block.

- Creation: GenLayer `0xaa3c0faa2b017ed9417e950cf7961f8195aba3915f4cdaab77f319e1245ecf05`.
- YES 0.100000 USDC: [`0x77048ef85c9caffdbe55ff36102af994f3dc452e4966e140d9c3fd10479d8fbf`](https://sepolia.basescan.org/tx/0x77048ef85c9caffdbe55ff36102af994f3dc452e4966e140d9c3fd10479d8fbf), log 9.
- NO 0.100000 USDC: [`0xf732d76666ce4313194a5371069cb61f9087bd7977c4aeecbd9a2ff9be370ca2`](https://sepolia.basescan.org/tx/0xf732d76666ce4313194a5371069cb61f9087bd7977c4aeecbd9a2ff9be370ca2), log 99.
- Adjudication: GenLayer `0xa057ffb567e769601e48b5737fc30be17a50f5a6d2ac1b2c551cbe2159e60bd9`,
  `MAJORITY_AGREE`, five commits/reveals, result `RESOLVED_NO` with 95% confidence.
- Canonical NO payout: 0.198500 USDC. Settlement:
  [`0xbd9e8d8837c60ec5620510038aac0f291c3f50b3458ae09c6bed0c03051ab0ff`](https://sepolia.basescan.org/tx/0xbd9e8d8837c60ec5620510038aac0f291c3f50b3458ae09c6bed0c03051ab0ff).
- Withdrawal: [`0xf675a3e7f62be8058f7509fc5a575503ef6b0a9352197c086fa17a15e7c44bb5`](https://sepolia.basescan.org/tx/0xf675a3e7f62be8058f7509fc5a575503ef6b0a9352197c086fa17a15e7c44bb5).
  Recipient balance changed from zero to `0.198500` USDC; claimable changed to zero.

## Adverse-path evidence and policy

- Unknown market deposits revert before `transferFrom`; tests confirm balances remain unchanged.
- Base market registration is authority-signed and binds chain, escrow, GenLayer contract,
  market id, and canonical market hash.
- The authority independently rejects pending/unsuccessful receipts, fabricated verdicts,
  wrong contract/market identities, and altered allocations.
- Pending deposits are escrow liabilities. Settlement and surplus withdrawal require
  `pending == 0`; signed acknowledgements or refunds consume each deposit exactly once.
- Relay recovery for the active escrow starts from deployment block `48280044`, not a recent rolling window.
- A two-instance race was observed live and handled idempotently: one instance acknowledged a
  deposit while the other re-read `handledDeposit` and completed without retry noise.
- Pause does not block servicing confirmed financial obligations or late-refund recovery.
- Event deadlines govern occurrence; a separate seven-day verification window permits delayed
  evidence. Validators agree on the decision-critical exact occurrence timestamp and deadline side.
- Fee values are snapshotted at creation. Quote and settlement use the same snapshot and the
  same empty-winning-side principal-refund policy.
- Archived cancellation proof: settlement `0x6a9c6daa72e3426105e48655d87b3e78243b97f2d3ce1a4b8e95da3cf540a5d6`;
  withdrawal `0xfa95382efb430a897fa12d8f71cf8bff2165e1ab549502a06c159539880556e6`.

## Reproducible verification

The historical value-transfer evidence above remains retained for review. The active immutable
pair is verified by its deployment receipts, matching backend/authority health reports, escrow
constructor reads, and the on-chain schema. Its reproducible gates are:

- `pytest -q tests/direct`: **45 passed**.
- `forge test -vv`: **11 passed**.
- `cd backend && npm test`: **2 passed**.
- `cd authority && npm test`: **3 passed**.
- `genvm-lint lint contracts/event_weaver.py`: **3 checks passed**.
- `cd frontend && npm run lint && npm run build`: successful with only documented warnings.

The suites cover protected custody, unknown markets, pending-liability reserve, authenticated
settlement, altered allocations, replay resistance, multiple logs per transaction, UTC-date
reversal, verification grace, pause recovery, late deposits, immutable fees, empty sides,
historical relay recovery, event-specific idempotency, and the complete signing boundary.
