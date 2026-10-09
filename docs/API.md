# EventWeaver Backend API

Base URL: `https://eventweaver-api-v2.fly.dev` (production) or `http://localhost:8080`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness/readiness: db, indexer lag, contract, uptime |
| GET | `/api/markets?status=&category=&limit=&offset=` | Indexed market list (newest first) |
| GET | `/api/markets/:id` | Single market (indexed, chain fallback) |
| GET | `/api/markets/:id/live` | Live-from-chain market read |
| GET | `/api/markets/:id/activity` | Recent activity events |
| GET | `/api/markets/:id/resolution` | Full resolution report with per-step reasoning |
| GET | `/api/portfolio/:address` | Positions, historical GenLayer payout quotes, live Base escrow claimability, balance, and notifications. May include `stale: true` during a temporary StudioNet throttle. |
| GET | `/api/stats` | Platform stats (volume, stakes, resolved) |
| GET | `/api/config` | Contract address, chain config, categories |
| GET | `/api/stakes/:txHash` | Status of one confirmed Base Sepolia deposit as the relayer turns it into a GenLayer position (`confirmed_onchain` / `retry_pending` / `applied`, or 404 while still awaiting confirmations) |
| GET | `/api/stakes?address=` | All of an address's confirmed deposits and their relay status |

Staking is a two-party flow, not a single client write:

1. The user's wallet calls `stake(marketId, side, amount)` directly on `EventWeaverEscrow` (Base Sepolia) — side (1=YES, 2=NO) travels with the deposit itself.
2. The backend's stake relay (`backend/src/stakeRelay.js`) watches for confirmed `Staked` events and is the *only* caller allowed to turn one into a position, via `record_stake(market_id, staker, side, amount, base_tx_hash)` on GenLayer.

This means a stake can never be recorded without a real, confirmed payment — including a deposit made directly against the escrow contract rather than through the website — and `base_tx_hash` makes the relay call idempotent, so a relayer retry after a crash between steps 1 and 2 can never double-credit a position. See `docs/ARCHITECTURE.md`.

Remaining writes happen client-side via genlayer-js against the Intelligent Contract:

| Contract method | Payable | Purpose |
| --- | --- | --- |
| `create_market(title, description, category, steps_json, deadline_ts, confidence_floor)` | no | Create a chain market |
| `record_stake(market_id, staker, side, amount, base_tx_hash)` | no | **Relayer only.** Record a confirmed Base Sepolia USDC stake on behalf of `staker` |
| `request_resolution(market_id)` | no | Full chain adjudication pass |
| `check_step(market_id, step_index)` | no | Single-step adjudication |
| `get_base_payouts(market_id)` | no | Final consensus payout list for the Base escrow relayer |
| Base escrow `claim(market_id)` | Base Sepolia | Winner self-claims USDC directly from escrow |
| `refund_cancelled(market_id)` | no | Return the cancellation allocation in the GenLayer position ledger |
| `cancel_market` / `expire_market` | no | Lifecycle |
| `pause` / `unpause` / `set_fees` / `set_minimums` / `set_owner` / `set_relayer` / `sweep_protocol_fees` | no | Owner admin |

Views: `get_market`, `get_markets`, `get_market_count`, `get_market_ids_by_status`,
`get_market_ids_by_category`, `get_steps`, `get_step`, `get_position`, `get_user_market_ids`,
`get_balance_of`, `get_pool`, `quote_payout`, `get_resolution_report`, `get_activity`,
`get_platform_stats`, `get_config`, `get_categories`, `is_stake_applied`.
