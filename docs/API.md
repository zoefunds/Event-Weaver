# EventWeaver Backend API

Base URL: `https://eventweaver-api.fly.dev` (production) or `http://localhost:8080`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness/readiness: db, indexer lag, contract, uptime |
| GET | `/api/markets?status=&category=&limit=&offset=` | Indexed market list (newest first) |
| GET | `/api/markets/:id` | Single market (indexed, chain fallback) |
| GET | `/api/markets/:id/live` | Live-from-chain market read |
| GET | `/api/markets/:id/activity` | Recent activity events |
| GET | `/api/markets/:id/resolution` | Full resolution report with per-step reasoning |
| GET | `/api/portfolio/:address` | Positions + payout quotes + balance + notifications |
| GET | `/api/stats` | Platform stats (volume, stakes, resolved) |
| GET | `/api/config` | Contract address, chain config, categories |

All writes happen client-side via genlayer-js against the Intelligent Contract:

| Contract method | Payable | Purpose |
| --- | --- | --- |
| `create_market(title, description, category, steps_json, deadline_ts, now_ts, confidence_floor)` | yes (bond) | Create a chain market |
| `stake_yes(market_id, now_ts)` / `stake_no(...)` | **yes** | Stake native value |
| `deposit()` | **yes** | Fund internal balance |
| `stake_from_balance(market_id, side, amount, now_ts)` | no | Stake from balance |
| `request_resolution(market_id, now_ts)` | no | Full chain adjudication pass |
| `check_step(market_id, step_index, now_ts)` | no | Single-step adjudication |
| `claim(market_id, now_ts)` | no | Claim winnings to balance |
| `withdraw(amount)` | no | **Native transfer out** to caller |
| `refund_cancelled(market_id, now_ts)` | no | Refund from cancelled market |
| `cancel_market` / `expire_market` | no | Lifecycle |
| `pause` / `unpause` / `set_fees` / `set_minimums` / `set_owner` / `sweep_protocol_fees` | no | Owner admin |

Views: `get_market`, `get_markets`, `get_market_count`, `get_market_ids_by_status`,
`get_market_ids_by_category`, `get_steps`, `get_step`, `get_position`, `get_user_market_ids`,
`get_balance_of`, `get_pool`, `quote_payout`, `get_resolution_report`, `get_activity`,
`get_platform_stats`, `get_config`, `get_categories`.
