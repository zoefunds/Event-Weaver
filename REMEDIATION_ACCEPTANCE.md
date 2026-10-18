# Financial Remediation and Live Acceptance Evidence

Date: 2026-10-18. Canonical branch: `main`. This record covers the second financial,
cross-chain recovery, chronology-consensus, and deployment-consistency remediation.

## Canonical matched deployment

| Component | Address / identity |
| --- | --- |
| GenLayer StudioNet contract | `0xEce2907092e324D0C9DE5fbaBaE20aA65E12C641` |
| Base Sepolia escrow | [`0xeCb1A2D7A72aF31C0F2F48858A505C3aF8279f4b`](https://sepolia.basescan.org/address/0xeCb1A2D7A72aF31C0F2F48858A505C3aF8279f4b) |
| Base Sepolia test USDC | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) |
| Relayer / deployment wallet | `0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb` |
| Independent settlement authority | `0xb26B9762edc49f261Ad9fF26FeF0AD6c43930D01` |
| Backend | [eventweaver-api-v2.fly.dev](https://eventweaver-api-v2.fly.dev) |
| Frontend | [eventweaver-orpin.vercel.app](https://eventweaver-orpin.vercel.app) |

The escrow constructor permanently binds the USDC token, relayer, independent authority,
and canonical GenLayer contract. Financial roles are immutable. Its deployment block is `48283907`.

Deployment evidence:

- GenLayer deployment `0x650616eaf223e46fc671bb3a5a1c04333c8950457c9f3c566006f675f3e6e3b1`:
  `ACCEPTED`, `MAJORITY_AGREE`, five commits, five reveals, and five AGREE votes; every GenVM
  execution receipt reported `SUCCESS`.
- Base deployment [`0xb3017cd54cd744b8afc2293c4d29dad74a2dc3a968558b5a1aec4afdd1379cc3`](https://sepolia.basescan.org/tx/0xb3017cd54cd744b8afc2293c4d29dad74a2dc3a968558b5a1aec4afdd1379cc3).
- Vercel production deployment `dpl_5oJ2QTmL35o3zVskAbRpBoFftoti` is aliased to the
  public frontend. Public backend `/health` and `/api/config` report the same GenLayer address.
- The authority runs as a separate Fly application. The backend contains no authority private
  key; it has only a private service URL and bearer token. The obsolete backend key secret was removed.

## Previous-pair YES outcome with losing-pool distribution

This retained evidence was executed on the immediately preceding pair and is not the canonical
deployment listed above.

1. Creation: GenLayer `0xcc1bf29421fed4eb7f3f28c1398027a677d547bc1b3c2f6dcc0a599626ad75f1`.
2. Authenticated Base registration: [`0x26a74058098248d88a8b0c2430e89033ec846f9066c5b9f8cca902c89d5943ad`](https://sepolia.basescan.org/tx/0x26a74058098248d88a8b0c2430e89033ec846f9066c5b9f8cca902c89d5943ad).
3. YES 0.100000 USDC: [`0x913882fac9102efc351fd5542fc53e69505bfa4b12fc696dfc99cccfeef2e35a`](https://sepolia.basescan.org/tx/0x913882fac9102efc351fd5542fc53e69505bfa4b12fc696dfc99cccfeef2e35a), deposit id `txHash:2`; NO 0.200000 USDC: [`0x08f7361aa8a4ed1e030a42274c77d7df389d13b328360850d907a06c6510c139`](https://sepolia.basescan.org/tx/0x08f7361aa8a4ed1e030a42274c77d7df389d13b328360850d907a06c6510c139), deposit id `txHash:103`.
4. Finalized successful GenVM resolution: `0x160628752e3b7fb3b510ba182b2b747ab3fb662d27eafd9c4a13b2b6ee09e7cb`, recorded through `/finalization-proof` as `RESOLVED_YES`.
5. Authority-signed settlement: [`0xe26f6e2e3958571c294e520226fa7d650a04c763fb24dec3875804f0f6d0aec1`](https://sepolia.basescan.org/tx/0xe26f6e2e3958571c294e520226fa7d650a04c763fb24dec3875804f0f6d0aec1), allocating 297000 units.
6. Recipient claim: [`0xf4e0615ecc550b2ea486b0954f04c11678eeef9f2991a2c1fb38316492d0693b`](https://sepolia.basescan.org/tx/0xf4e0615ecc550b2ea486b0954f04c11678eeef9f2991a2c1fb38316492d0693b). Balance was `120895500` before claim and `121192500` after claim (+297000 base units).

## Historical live YES outcome with losing-pool distribution

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
- Relay recovery for the active escrow starts from deployment block `48283907`, not a recent rolling window.
- A two-instance race was observed live and handled idempotently: one instance acknowledged a
  deposit while the other re-read `handledDeposit` and completed without retry noise.
- Pause does not block servicing confirmed financial obligations or late-refund recovery.
- Event deadlines govern occurrence; a separate seven-day verification window permits delayed
  evidence. Validators agree on the decision-critical exact occurrence timestamp and deadline side.
- Fee values are snapshotted at creation. Quote and settlement use the same snapshot and the
  same empty-winning-side principal-refund policy.
- Fresh matched-pair funded cancellation: GenLayer market creation
  `0xa8adf93d15e586a542f1a3d434a8a00c4d5dca0c006fdbd02beb5891f558e141`, Base
  registration [`0x6226eceb298733e29ebb94ef23fcce7950dff0b60df82c1015872f7c78798063`](https://sepolia.basescan.org/tx/0x6226eceb298733e29ebb94ef23fcce7950dff0b60df82c1015872f7c78798063),
  confirmed 0.100000-USDC stake [`0x5fdfdaf054dcbc0ce6faf65669e9b5c3bb5aece64603cdb3c487c2ad0ccaf5f7`](https://sepolia.basescan.org/tx/0x5fdfdaf054dcbc0ce6faf65669e9b5c3bb5aece64603cdb3c487c2ad0ccaf5f7)
  (event log 271), finalized cancellation
  `0x3f50c5896ae5cc1585687fceb0176598cfcd37e16a924442c0fe85a82f701e06`, authority-signed
  settlement [`0x77af5eb5ca6b834567239767f7294ce8214b43c33acde9afe1897727f5f2eb79`](https://sepolia.basescan.org/tx/0x77af5eb5ca6b834567239767f7294ce8214b43c33acde9afe1897727f5f2eb79), and
  claim [`0x5ac953728358c79579e7bb7cba3b816d151abccf4d35759bcf0688b88edc45cf`](https://sepolia.basescan.org/tx/0x5ac953728358c79579e7bb7cba3b816d151abccf4d35759bcf0688b88edc45cf).
  The pool was `deposited=100000, pending=0` before settlement; the recipient’s balance was
  `121092500` before claim and `121192500` after (+100000 units).

- Fresh matched-pair applied late-deposit recovery: market 2 was created by GenLayer
  [`0x939e81c9fb080f575ef53dd87d11531091b16585e1092cbc301307705f368e5d`](https://studio.genlayer.com/transactions/0x939e81c9fb080f575ef53dd87d11531091b16585e1092cbc301307705f368e5d)
  and cancelled by the wallet in finalized transaction
  [`0x27da0ec02452b2b1f1d109a2cb62094b8925ac68f04df23122322b2050aa06ea`](https://studio.genlayer.com/transactions/0x27da0ec02452b2b1f1d109a2cb62094b8925ac68f04df23122322b2050aa06ea).
  A **post-terminal** 0.100000-USDC Base deposit
  [`0xd1ed52707cd0a2085647cf5b8eb59b221e660364570eca9e6a00aa1a6e274454`](https://sepolia.basescan.org/tx/0xd1ed52707cd0a2085647cf5b8eb59b221e660364570eca9e6a00aa1a6e274454)
  at log index `11` was persisted, relayed, and canonical GenLayer state showed
  `late_amount=100000`, `yes_amount=0`, `no_amount=0`. Its Base pool moved from
  `pending=100000` to `pending=0`, proving the separately authenticated late path consumed
  the reserve. Authority-signed settlement
  [`0x5d74dd95b69652354cd6311d6ca07f48e3e846c960f63e50b8033205c0f30fa4`](https://sepolia.basescan.org/tx/0x5d74dd95b69652354cd6311d6ca07f48e3e846c960f63e50b8033205c0f30fa4)
  allocated the exact 100000-unit refund. The recipient claimed it in
  [`0xe42341f91090d292ce89d260216740582c742ca65901033b98e7ca94b7df5bc5`](https://sepolia.basescan.org/tx/0xe42341f91090d292ce89d260216740582c742ca65901033b98e7ca94b7df5bc5):
  claimable is now zero and the wallet returned from `121092500` to `121192500` units.

## Reproducible verification

The historical value-transfer evidence above remains retained for review. The active immutable
pair is verified by its deployment receipts, matching backend/authority health reports, escrow
constructor reads, and the on-chain schema. Its reproducible gates are:

- `pytest -q tests/direct`: **48 passed**.
- `forge test -vv`: **11 passed**.
- `cd backend && npm test`: **4 passed**.
- `cd authority && npm test`: **5 passed**.
- `genvm-lint lint contracts/event_weaver.py`: **3 checks passed**.
- `cd frontend && npm run lint && npm run build`: successful with only documented warnings.

The suites cover protected custody, unknown markets, pending-liability reserve, authenticated
settlement, altered allocations, replay resistance, multiple logs per transaction, UTC-date
reversal, verification grace, pause recovery, late deposits, immutable fees, empty sides,
historical relay recovery, event-specific idempotency, and the complete signing boundary.
