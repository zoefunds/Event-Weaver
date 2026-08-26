# EventWeaver V1 Architecture

EventWeaver V1 is a cross-chain prediction market. GenLayer determines market outcomes. Base Sepolia USDC provides the reserve asset, deposits, and user payouts.

For deployed addresses, lifecycle, configuration, and the operating checklist, see [V1](../v1.md).

## System overview

```text
React frontend on Vercel
  |\
  | \ GenLayer wallet writes: create market, record YES or NO stake, adjudicate
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
| Base escrow | Custodies USDC, records allocations, transfers claims | Decide a market outcome or alter payout rules |
| Backend relayer | Relays the immutable `get_base_payouts` output into escrow settlement | Select winners or claim a user's USDC |
| User wallet | Approves, stakes, and claims | Alter consensus outcome or another user's claim |

## Data and value flow

1. The frontend submits `create_market` to GenLayer.
2. To stake, the wallet deposits USDC into Base escrow and records an equal six-decimal amount on GenLayer for YES or NO.
3. The backend resolver requests adjudication when a market is due. Validators fetch the configured public evidence and the GenLayer contract finalizes the market.
4. The relayer reads `get_base_payouts`, verifies that allocations do not exceed the escrowed amount, and submits the one-time Base `settle` call.
5. The recipient calls `claim`. The escrow transfers USDC directly to that wallet.

## Read path and rate-limit posture

The frontend reads market lists from the Fly Postgres mirror. A live GenLayer fallback is used only when necessary. The portfolio endpoint joins GenLayer positions with Base escrow `claimable` values, because the latter is authoritative after an EVM claim.

StudioNet has a shared rate budget. Indexing, automatic resolution, and settlement scans run every five minutes. Portfolio results are cached per address for 60 seconds. If a fresh chain read is rate-limited and a cached portfolio exists, the API returns that cached data with `stale: true` rather than failing the page.

## Security properties

- The relayer private key exists only as a Fly secret.
- The frontend contains no private key and never sends one to the API.
- Settlement may be performed once per market and allocations cannot exceed the escrowed pool.
- The escrow's `claimable` mapping prevents a second claim.
- Outcome evaluation is executed by GenLayer validators, not by the backend.
- The contract uses an internal consensus time source, not caller-supplied timestamps.
