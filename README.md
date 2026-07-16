# EventWeaver

**Prediction markets for chain reactions, not isolated events.**

Traditional prediction markets ask *"Will X happen?"*. EventWeaver markets are **ordered chains
of dependent real-world conditions** — *if Apple launches AR glasses before June, then Meta
delays Orion, then Qualcomm rises 10% within 30 days* — and resolve YES only if the **entire
chain** occurs, in order, verified against **live web evidence** by GenLayer's AI-validator
consensus (Optimistic Democracy).

## Why GenLayer is essential here

Resolving a causal chain requires judgment over unstructured, real-world evidence — news pages,
official announcements, filings. No deterministic oracle can do this. EventWeaver's Intelligent
Contract:

1. **Fetches declared evidence sources live** inside the validator sandbox (`gl.nondet.web.render`),
2. **Reasons over the actual page content** with an LLM (`gl.nondet.exec_prompt`, JSON verdicts),
3. Reaches consensus via **comparative semantic equivalence** (`gl.eq_principle.prompt_comparative`)
   with an outcome-focused tolerance principle — validators agree on the verdict booleans and a
   coarse confidence band, not on byte-identical prose, so honest validators converge and
   markets don't get stuck in Undetermined states,
4. Stores the **full reasoning trail on-chain** per step for transparent auditability.

## Real value-transfer path

- `stake_yes` / `stake_no` / `deposit` are **payable** — the chain moves native GEN from the
  caller into the contract (`gl.message.value`).
- `claim(market_id)` credits stake + pro-rata share of the losing pool (minus 1% protocol +
  0.5% creator fee) to an internal balance.
- `withdraw(amount)` emits a **real native-token transfer** from the contract back to the
  caller via `emit_transfer(value=…, on='finalized')`.

## Architecture

```
frontend/   Vite + React + Tailwind ("Causal Web" design system) → Vercel
backend/    Express indexer + REST API (genlayer-js) → Fly.io, 24/7 (never scales to zero)
contracts/  event_weaver.py — single production Intelligent Contract → GenLayer StudioNet
docs/       architecture, API, deployment
MEMORY.md   living decision log + hard-won GenLayer gotchas
```

- **Contract** (~1,300 lines): markets, ordered chain steps with per-step evidence sources and
  verdict state machines, payable staking pools, pro-rata settlement, fees/bonds, activity log,
  admin controls, 17 view + 18 write methods with schema-safe signatures.
- **Backend**: resilient poller mirrors on-chain state into Postgres (in-memory fallback),
  serves discovery/portfolio APIs, `/health` for Fly checks. Process never dies:
  uncaught exceptions are logged not fatal, indexer self-heals with backoff, Fly keeps
  ≥1 machine always running with restart policy.
- **Frontend**: Landing, Discovery, Market detail (causal chain view + trading panel +
  activity feed), Visual Logic Builder (create), Portfolio (positions, claims, withdraw).
  MetaMask auth via genlayer-js.

## Quick start (local)

```bash
# backend (indexer + API on :8080)
cd backend && npm install && node src/server.js

# frontend (on :5173)
cd frontend && npm install && npm run dev
```

Environment:
- backend: `CONTRACT_ADDRESS`, `DATABASE_URL` (optional locally), `CORS_ORIGINS`
- frontend: `VITE_API_URL`, `VITE_CONTRACT_ADDRESS`

## Contract deployment (StudioNet)

```bash
genlayer network set studionet
genlayer deploy --contract contracts/event_weaver.py --args 0 0   # min_bond, min_stake
```

Quality gates: `genvm-lint check contracts/event_weaver.py` (3/3 clean), schema extraction
verified against the pinned runner (`py-genlayer:1jb45aa8…`), plus live StudioNet integration
tests (create → stake with value → adjudicate against apple.com/newsroom → report).

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/CONTRACT.md](docs/CONTRACT.md)
