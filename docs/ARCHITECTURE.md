# EventWeaver Architecture

## System overview

```
┌─────────────┐     REST      ┌──────────────────┐   genlayer-js   ┌──────────────────┐
│  Frontend    │ ───────────▶ │  Backend API      │ ──────────────▶ │  GenLayer         │
│  React/Vite  │              │  Express (Fly.io) │    reads        │  StudioNet        │
│  (Vercel)    │              │  + Postgres index │                 │                   │
└─────┬───────┘              └──────────────────┘                 │  EventWeaver IC   │
      │            writes (MetaMask + genlayer-js, payable value)  │  (event_weaver.py)│
      └──────────────────────────────────────────────────────────▶└──────────────────┘
```

**Reads** are served from the backend's Postgres mirror (fast, filterable) with a live-chain
fallback per market. **Writes** (create, stake with value, adjudicate, claim, withdraw) go
directly from the user's wallet to the Intelligent Contract — the backend never holds keys.

## The Intelligent Contract (single contract by design)

State:
- `markets: TreeMap[u32, Market]` — metadata, pools, status, resolution summary
- `market_steps: TreeMap[u32, DynArray[ChainStep]]` — the ordered chain with verdict state
- `positions: TreeMap[str, Position]` keyed `marketId:0xaddr`
- `balances: TreeMap[Address, u256]` — internal withdrawable native balances
- `activity: TreeMap[u32, DynArray[ActivityEvent]]` — audit log

Market lifecycle: `OPEN → RESOLVING → RESOLVED_YES | RESOLVED_NO | EXPIRED` (plus `CANCELLED`).
Steps are verified strictly in order; a fulfilled step is sticky (events don't un-happen);
inconclusive evidence never flips a step — it stays PENDING (this is what prevents both
premature resolution and consensus deadlock). A failed step breaks the chain → NO wins.
Deadline passage with an incomplete chain → EXPIRED → NO wins.

### Adjudication (non-deterministic block)

Per step, inside `gl.eq_principle.prompt_comparative`:
1. Each declared source URL is rendered defensively (`gl.nondet.web.render`, text mode);
   dead sources degrade to error records instead of aborting.
2. A structured prompt (condition + prior-chain context + timing + evidence excerpts) goes to
   the LLM with `response_format="json"`.
3. The verdict is sanitized (markdown fences stripped, alias keys, string booleans, confidence
   bucketed to nearest 5) into `{occurred, can_still_occur, confidence, reasoning,
   evidence_summary}`.
4. The equivalence principle accepts the leader's result iff validators agree on both booleans
   and confidence within 25 points — wording differences are irrelevant.

### Value flow

```
wallet ──(payable stake/deposit)──▶ contract pools/balances
contract ──(claim: pro-rata of losing pool − fees)──▶ internal balance
internal balance ──(withdraw → emit_transfer on finalized)──▶ wallet
```

## Backend (24/7 posture)

- Poller every 15s: market count → per-market state + activity → Postgres upserts (idempotent).
- Failure containment: every cycle wrapped; consecutive failures add linear backoff; process
  handlers convert uncaughtException/unhandledRejection into logs.
- Fly.io: `auto_stop_machines=off`, `min_machines_running=1`, `[[restart]] policy=always`,
  HTTP health checks against `/health` (reports db + indexer state).
- DB optional: without `DATABASE_URL` an in-memory mirror keeps the API functional (dev mode).

## Frontend

Pages: Landing, Discovery (filters/sort/empty/loading/error states), Market detail (causal
chain view, GenLayer reasoning, activity feed, stake/adjudicate/claim panel), Create (visual
logic builder, validation), Portfolio (positions, quotes, claims, withdraw, notifications).
Design system "Causal Web": dark glassmorphism, Logic Blue / Adjudication Purple / Emerald,
Geist + Inter + JetBrains Mono, responsive 12-column grid.

## Security model

- No custodial keys anywhere; wallet-signed writes only.
- Contract guards every write with deterministic `EXPECTED:` errors; owner-only admin
  (pause/fees/minimums/sweep); fee cap 10%; step/URL/text length rails.
- Backend: helmet, CORS allowlist, JSON body limit, input validation on params, no secrets in
  code (Fly secrets / Vercel env).
- Timestamps are caller-supplied (GenVM has no trusted clock); they gate UX-level checks while
  ordering-critical logic (step order, stickiness) is timestamp-independent.
