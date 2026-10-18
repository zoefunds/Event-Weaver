# EventWeaver V1 Architecture

EventWeaver V1 is a cross-chain prediction market. GenLayer determines market outcomes. Base Sepolia USDC provides the reserve asset, deposits, and user payouts.

For deployed addresses, lifecycle, configuration, and the operating checklist, see [V1](../v1.md).

## System overview

```text
React frontend on Vercel
  |\
  | \ GenLayer wallet writes: create market and adjudicate
  |  \
  |   GenLayer StudioNet EventWeaver contract
  |              ^
  |              | indexed reads and final payout list
  |              |
  +--------> Express API on Fly.io with Postgres
                   |                 |
                   |                 +-- deadline resolver
                   +-- Base Sepolia settlement relayer
                                      |
Wallet on Base Sepolia ----------------+-- USDC approve, escrow stake, claim
                                      |
                              EventWeaverEscrow
```

## Trust boundaries

| Component | Responsibility | Cannot do |
| --- | --- | --- |
| GenLayer contract | Stores market rules and positions, evaluates evidence in validator consensus, calculates final payouts | Custody or transfer USDC in V1 |
| Base escrow | Custodies USDC, verifies signed canonical allocations, protects claims, transfers claims | Decide a market outcome or accept an unsigned/altered payout |
| Backend relayer | Relays confirmed `Staked` logs and submits authority-approved settlements/refunds | Unilaterally select winners, alter allocations, or claim a user's USDC |
| Settlement authority | Independently signs commitments bound to the finalized verdict, escrow, chain, market and exact payout | Move funds directly or bypass escrow accounting |
| User wallet | Approves, stakes, and claims | Alter consensus outcome or another user's claim |

## Data and value flow

1. The frontend submits `create_market` to GenLayer.
2. To stake, the wallet deposits USDC into Base escrow. After confirmations, the backend records that exact `Staked` event on GenLayer using `txHash:logIndex` as its idempotency key.
3. The backend resolver requests adjudication at the event-occurrence deadline. Validators fetch
   the configured public evidence; later-published evidence may establish an on-time event
   during the seven-day verification window, after which an unresolved chain expires to NO.
4. The independent authority reads the finalized GenLayer verdict/payout and Base pool itself, signs the canonical commitment, and the relayer submits the one-time Base `settle` call. A deposit that cannot be applied is recovered through separately signed `allocateDepositRefund`.
5. The recipient calls `claim`. The escrow transfers USDC directly to that wallet.

## Read path and rate-limit posture

The frontend reads market lists from the Fly Postgres mirror. A live GenLayer fallback is used only when necessary. The portfolio endpoint joins GenLayer positions with Base escrow `claimable` values, because the latter is authoritative after an EVM claim.

StudioNet has a shared rate budget. Indexing, automatic resolution, and settlement scans run every five minutes. Portfolio results are cached per address for 60 seconds. If a fresh chain read is rate-limited and a cached portfolio exists, the API returns that cached data with `stale: true` rather than failing the page.

## Security properties

- The backend holds only the transaction relayer key plus an authenticated private connection
  to the authority. The independent settlement-authority private key exists only in its
  separate Fly service.
- The frontend contains no private key and never sends one to the API.
- Settlement may be performed once per market, requires an authority signature, and allocations cannot exceed the escrowed pool.
- Active deposits, pending late refunds, and allocated but unclaimed winnings cannot be administratively withdrawn. A post-settlement surplus withdrawal requires a separate nonce-bound authority signature.
- The escrow's `claimable` mapping prevents a second claim.
- Outcome evaluation is executed by GenLayer validators, not by the backend.
- The contract uses an internal consensus time source, not caller-supplied timestamps.
