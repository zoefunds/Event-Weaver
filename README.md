<div align="center">

# 🕸 EventWeaver

**Prediction markets for chain reactions, not isolated events.**

*Trustless causal-chain adjudication powered by GenLayer Intelligent Contracts.*

[**Live App**](https://eventweaver-orpin.vercel.app) · [**API**](https://eventweaver-api-prod.fly.dev/health) · [**Contract on StudioNet**](#deployed-addresses) · [**Docs**](docs/)

![Landing page](docs/images/landing.png)

</div>

---

## Table of contents

1. [What is EventWeaver](#what-is-eventweaver)
2. [Why this needs GenLayer](#why-this-needs-genlayer)
3. [Screenshots](#screenshots)
4. [V1 documentation](v1.md)
5. [How a market works (lifecycle)](#how-a-market-works)
6. [The value-transfer path](#the-value-transfer-path)
7. [Architecture](#architecture)
8. [The Intelligent Contract](#the-intelligent-contract)
9. [Backend (24/7)](#backend-247)
10. [Frontend](#frontend)
11. [Running locally](#running-locally)
12. [Deployment](#deployment)
13. [Testing & quality gates](#testing--quality-gates)
14. [Deployed addresses](#deployed-addresses)
15. [Authenticated clock design](#authenticated-clock-design)
16. [Reliability: stale builds & RPC rate limits](#reliability-stale-builds--rpc-rate-limits)
17. [Path forward](#path-forward)
18. [Project structure](#project-structure)
19. [Hard-won GenLayer lessons](#hard-won-genlayer-lessons)

---

## What is EventWeaver

Traditional prediction markets ask a single question: *"Will X happen?"*

EventWeaver markets are **ordered chains of dependent real-world conditions**:

> **IF** Apple releases the Vision Pro →
> **THEN** Apple releases the iPhone 16 →
> **THEN** Apple announces a foldable iPhone before the deadline

The market resolves **YES only if every step in the chain verifiably occurred, in order**.
One broken link and NO wins. Steps are verified against **live public web evidence** —
news pages, official announcements, price feeds, filings — by GenLayer's decentralized
AI-validator consensus, and every verdict's reasoning is stored on-chain for anyone to audit.

**V1 payment rail:** users stake **USDC on Base Sepolia**. GenLayer records positions and
adjudicates outcomes; a Base Sepolia escrow holds deposits and winners self-claim USDC.

## V1 — USDC on Base Sepolia

The original native-GEN payment path has been replaced. `EventWeaverEscrow` is deployed at
[`0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C`](https://sepolia.basescan.org/address/0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C)
on Base Sepolia and uses test USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

1. A staker approves USDC and calls the Base escrow's `stake(marketId, amount)`.
2. The same wallet records `stake_yes(marketId, amount)` or `stake_no(...)` on GenLayer.
3. On terminal resolution, the backend relayer reads GenLayer's consensus-derived payout list
   and calls escrow `settle` exactly once.
4. Winners call escrow `claim(marketId)` directly; the backend never custody-transfers funds.

Set `VITE_BASE_ESCROW_ADDRESS` in the frontend and `BASE_SEPOLIA_RELAYER_PRIVATE_KEY` in the
backend before running the full flow. Deploy the updated GenLayer contract before using V1:
its stake method signatures have changed and it is intentionally not compatible with the old
native-GEN deployment.

For the complete V1 migration record, addresses, configuration, lifecycle, reliability design,
and verification checklist, read **[v1.md](v1.md)**.

## Why this needs GenLayer

Resolution is a **trust problem, not an inference problem** — whoever resolves a market
controls the money, so resolution must be decentralized and the evidence must be verified
*inside consensus*, not asserted by a server:

- **Contract-side web fetching.** At adjudication time, each GenLayer validator
  independently renders the market's declared evidence URLs (`gl.nondet.web.render`)
  *inside GenVM*. No off-chain oracle feed, no user-submitted claims, no API keys.
- **Validators verify outcomes, not formats.** The equivalence principle
  (`gl.eq_principle.prompt_comparative`) requires validators to agree on the **actual
  verdict** — the `occurred` / `can_still_occur` booleans and a confidence band — after
  each has done its own fetch and LLM reasoning over the real page content.
- **Consensus-stable by design.** Verdicts are deliberately coarse (confidence bucketed to
  the nearest 5, sticky FULFILLED states, inconclusive-stays-PENDING), so honest validators
  converge. Verified live on StudioNet: one-round `MAJORITY_AGREE`, zero leader rotations,
  zero Undetermined results.
- **Transparent.** Per-step reasoning and evidence summaries are persisted on-chain and
  rendered in the UI's resolution report (see the screenshot below).

This cannot work as an off-chain AI app: a centralized resolver could steal every pool.

## Screenshots

**Discovery — live causal-chain markets with real evidence sources:**

![Market discovery](docs/images/discovery.png)

**A resolved market — validators fetched Wikipedia/apple.com live and wrote their
reasoning on-chain (steps 1–2 FULFILLED at 100% confidence, step 3 FAILED):**

![Resolved market with on-chain reasoning](docs/images/market-detail.png)

**The Visual Logic Builder — compose the chain, attach evidence URLs, set the
confidence floor, deploy:**

![Create market](docs/images/create-market.png)

**First-visit walkthrough — five-step guided tour for new users (re-open any time via
"Take the tour" in the footer):**

![Walkthrough](docs/images/walkthrough.png)

## How a market works

```
OPEN ──────────────► RESOLVING ──────────► RESOLVED_YES   (every step FULFILLED)
 │   creator checks     │    auto-resolver ► RESOLVED_NO    (any step FAILED)
 │   steps early        │    at deadline   ► EXPIRED → NO   (deadline, chain incomplete)
 └──────────────────────┴─────────────────► CANCELLED       (refunds for everyone)
```

1. **Create** — anyone defines a 2–12 step chain; each step carries a natural-language
   condition and 1–5 public evidence URLs. A confidence floor (55–95%) sets how strong the
   evidence must be to flip a step.
2. **Stake** — anyone deposits Base Sepolia USDC on YES/NO **until the deadline**, even while
   adjudication is in progress. Odds are implied by the pool ratio.
3. **Adjudicate** —
   - *Before the deadline*: only the market creator (or platform owner) can trigger step
     checks, useful for progressively verifying long chains.
   - *After the deadline*: adjudication is permissionless **and automatic** — the 24/7
     backend resolver triggers it, validators fetch the evidence, and the chain settles.
   - Steps verify strictly in order; a FULFILLED step is sticky (events don't un-happen);
     inconclusive evidence never flips a step — it stays PENDING and is retried.
4. **Settle & claim** — winners receive stake + a pro-rata share of the losing pool (minus
   1% protocol + 0.5% creator fee) as a self-serve USDC claim from Base Sepolia escrow.

## The value-transfer path

Real USDC movement at every hop — no synthetic points:

| Hop | Mechanism |
| --- | --- |
| Stake in | wallet approves USDC then calls Base escrow `stake(marketId, amount)`; GenLayer records the matching position |
| Settlement | the relayer reads GenLayer `get_base_payouts` and calls escrow `settle` once after finalization |
| Claim out | winner calls Base escrow `claim(marketId)` and receives a real USDC transfer |
| Fees | 1% protocol + 0.5% creator are withheld from the losing pool when GenLayer calculates allocations |

All four hops are exercised live on StudioNet (see [docs/CONTRACT.md](docs/CONTRACT.md)).

## Architecture

```
┌──────────────┐    REST      ┌────────────────────┐  genlayer-js   ┌────────────────────┐
│  Frontend     │ ───────────► │  Backend API        │ ─────────────► │  GenLayer StudioNet │
│  React + Vite │              │  Express on Fly.io  │    reads       │                    │
│  (Vercel)     │              │  + Fly Postgres     │                │  EventWeaver        │
└──────┬───────┘              │  indexer + resolver │                │  Intelligent        │
       │   GenLayer writes    └────────────────────┘                │  Contract           │
       └───────────────────────────────────────────────────────────►└────────────────────┘
       │
       └── Base Sepolia USDC approve, stake, and claim ──► EventWeaverEscrow
```

- **Reads** are served from the backend's Postgres mirror (fast, filterable), with a
  live-chain fallback per market.
- **Writes** go directly from the user's wallet: market and position writes use GenLayer,
  while USDC approvals, deposits, and claims use Base Sepolia — the backend never holds user keys.
- The backend also runs the **automatic deadline resolver** (Intelligent Contracts can't
  wake themselves; the always-on service is the trigger, while the *outcome* is decided
  trustlessly by validators).

Full details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/API.md](docs/API.md)

## The Intelligent Contract

Single production contract: [`contracts/event_weaver.py`](contracts/event_weaver.py)
(~1,300 lines, 35 public methods — 17 views, 18 writes, schema-safe signatures).

- **Storage**: `TreeMap[u32, Market]`, per-market `DynArray[ChainStep]` with verdict state
  machines, positions and staker lists keyed by market, plus an append-only activity log.
- **Adjudication block** (per step, inside `gl.eq_principle.prompt_comparative`):
  1. Render each evidence URL defensively (a dead source degrades to an error record
     instead of aborting the transaction).
  2. Prompt the LLM with the condition, prior-chain context, timing, and evidence excerpts;
     request JSON.
  3. Sanitize the verdict (markdown fences, alias keys, stringly booleans, confidence
     bucketing) before it touches state.
  4. Validators accept iff verdict booleans match and confidence is within 25 points —
     wording differences are irrelevant.
- **Error discipline**: deterministic prefixes `EXPECTED:` / `EXTERNAL:` / `TRANSIENT:` /
  `LLM_ERROR:` so clients can react programmatically.
- **Admin**: pause/unpause, fee schedule (hard 10% cap), minimums, ownership transfer,
  protocol-fee sweep.
- **Authenticated clock**: staking windows, adjudication rights, expiry, and settlement all
  read time from an internal `_now_ts()` sourced from GenVM's consensus-agreed block clock —
  never from caller-supplied calldata. See [Authenticated clock design](#authenticated-clock-design).

Reference: [docs/CONTRACT.md](docs/CONTRACT.md)

## Backend (24/7)

`backend/` — Express + genlayer-js + Fly Postgres. **This process must never die**:

- Uncaught exceptions and unhandled rejections are logged, not fatal.
- The indexer, resolver, and Base settlement relay run every five minutes to stay under the
  shared StudioNet RPC budget. Each loop self-heals with backoff.
- Fly.io: `auto_stop_machines = "off"`, `min_machines_running = 1`, restart policy
  `always`, HTTP health checks against `/health` (reports db, indexer lag, resolver stats).
- Works without a database too (in-memory mirror) for zero-config local dev.
- **RPC budget discipline**: StudioNet's RPC caps at 30 requests/minute, shared across the
  indexer, resolver, and every live-reading route. `readContract` retries rate-limit errors
  with backoff; `/api/config` and `/api/portfolio/:address` are short-TTL cached so repeated
  or near-instant reloads cost zero extra chain reads; the indexer's poll interval is tuned
  to leave headroom under the cap rather than exhaust it on its own.

Endpoints: markets (list/detail/live/activity/resolution), portfolio (positions, quotes,
balance, notifications), stats, config, health — see [docs/API.md](docs/API.md).

## Frontend

`frontend/` — Vite + React + TypeScript + Tailwind v4, deployed to Vercel with Analytics.

- **Pages**: Landing, Discovery (status/category filters, sort, empty/loading/error
  states), Market detail (causal-chain view with per-step reasoning + evidence links,
  GenLayer resolution report, activity feed, stake/claim panel), Create (visual logic
  builder with validation), Portfolio (positions, live Base escrow claimability,
  notifications).
- **Wallet**: MetaMask / injected EIP-1193. GenLayer writes record market state while Base
  Sepolia transactions approve, deposit, and claim six-decimal USDC.
- **Design system**: "Causal Web" — dark glassmorphism, Logic Blue `#adc6ff`/`#4d8eff`,
  Adjudication Purple `#571bc1`, Emerald `#4edea3`; Geist / Inter / JetBrains Mono;
  custom woven-chain logo and favicon.
- **Onboarding**: first-visit walkthrough (suppress with `?tour=0`).
- **Stale-build self-healing**: a tab left open across a backend/contract migration keeps
  running whatever config was baked into its JS bundle — including a now-dead API URL. Every
  tab polls for a new build in the background and, once confirmed, clears
  `localStorage`/`sessionStorage` and reloads automatically (`lib/versionCheck.ts`), instead
  of failing silently forever with no signal to the user.

## Running locally

Prereqs: Node 22+, Python 3.13 (for contract tooling), the [GenLayer CLI](https://docs.genlayer.com/)
(`npm i -g genlayer`).

```bash
git clone https://github.com/zoefunds/Event-Weaver.git && cd Event-Weaver

# backend — API + indexer + resolver on :8080 (in-memory DB when DATABASE_URL unset)
cd backend && npm install && node src/server.js

# frontend — on :5173
cd ../frontend && npm install && npm run dev
```

Environment (see `.env.example` in each package):

| Package | Variable | Purpose |
| --- | --- | --- |
| backend | `CONTRACT_ADDRESS` | EventWeaver contract on StudioNet |
| backend | `DATABASE_URL` | Postgres (optional locally) |
| backend | `BASE_ESCROW_ADDRESS`, `BASE_SEPOLIA_RELAYER_PRIVATE_KEY`, `POLL_INTERVAL_MS`, `RESOLVER_INTERVAL_MS` | V1 USDC settlement and rate-safe ops tuning |
| frontend | `VITE_API_URL` | backend base URL |
| frontend | `VITE_CONTRACT_ADDRESS` | contract address for wallet writes |

## Deployment

Full guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Short version:

```bash
# 1. Contract → GenLayer StudioNet (constructor: min_creation_bond=0, min_stake=0)
genlayer network set studionet
genlayer deploy --contract contracts/event_weaver.py --args 0 0
genlayer schema <ADDRESS>   # must print the full 35-method schema

# 2. Backend → Fly.io (24/7)
cd backend && fly deploy
fly secrets set CONTRACT_ADDRESS=0x… CORS_ORIGINS=https://your-app.vercel.app

# 3. Frontend → Vercel
cd frontend && vercel deploy --prod
```

> ⚠️ The `# { "Depends": … }` header must be **line 1 with a blank line after it** — GenVM
> parses the whole leading comment block as runner config; violating this yields
> `invalid_contract` / "could not load contract schema".

## Testing & quality gates

| Gate | Command | Status |
| --- | --- | --- |
| Contract lint | `genvm-lint lint contracts/event_weaver.py` | 3/3 clean |
| Schema extraction | verified against the pinned runner SDK | 35 methods |
| **Direct unit tests** | `pytest tests/direct/ -v` (gltest.direct, mocked web/LLM) | **29 passing** |
| Live integration | StudioNet: create → Base USDC stake → adjudicate real URLs → Base escrow settlement → claim | verified |
| CI | GitHub Actions: lint + direct tests + backend check + frontend build | on every push |

The direct suite covers creation validation, USDC-denominated stake accounting, settlement math with fees,
verdict handling (high-confidence, chain-break, inconclusive, malformed LLM output),
adjudication permissions, expiry, cancellation/refunds, admin controls, and 5 adversarial
tests proving fabricated future/stale timestamps cannot change betting access or force a
payout (see [Authenticated clock design](#authenticated-clock-design)).

## Deployed addresses

| Component | Where |
| --- | --- |
| Intelligent Contract | `0x96727fd9E35036903B89829E1349dB5A83e7c48f` (GenLayer StudioNet, V1 USDC ledger) |
| Base Sepolia USDC escrow | [`0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C`](https://sepolia.basescan.org/address/0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C) |
| Base Sepolia test USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Backend API | https://eventweaver-api-prod.fly.dev (Fly app `eventweaver-api-prod` + Postgres `eventweaver-db-new`, org `priscilla-george`, region `iad`) |
| Frontend | https://eventweaver-orpin.vercel.app |

> The backend and database were migrated to the `priscilla-george` Fly.io organization. The
> legacy database was deleted. The indexer prunes rows outside the active contract's id range,
> preventing retired markets from appearing as stakeable.

## Authenticated clock design

Every state-changing method used to accept a caller-supplied `now_ts: int` argument that
drove staking windows, adjudication rights, expiry, and settlement — a transaction sender
could pass a fabricated future or stale timestamp to manipulate any of them. This has been
replaced with an internal `_now_ts()` that reads `datetime.datetime.now()`, which GenVM
patches to the network's consensus-agreed block time for every validator identically. No
caller, including the market creator or platform owner, can influence it.

Five adversarial tests in [tests/direct/test_event_weaver.py](tests/direct/test_event_weaver.py)
prove fabricated timestamps can no longer change betting access or force a payout — see
[review.md](review.md) for the full writeup (problem, fix, and verification).

## Reliability: stale builds & RPC rate limits

Two related classes of failure surfaced as "Failed to fetch" / "Could not load portfolio"
errors after the account migration, both now fixed:

- **Stale tabs after a backend/contract move.** A tab left open across a migration keeps
  running the JS bundle (and hardcoded config) it loaded with — including an API URL that no
  longer resolves once the old host is retired. Every tab now polls in the background for a
  new build and, once confirmed, clears `localStorage`/`sessionStorage` and reloads
  automatically (`frontend/src/lib/versionCheck.ts`), so a stale tab self-heals within
  minutes instead of failing forever with no explanation.
- **StudioNet's shared RPC limit (500 requests/hour).** Background scans now run every five
  minutes. Portfolio data is cached for 60 seconds and falls back to the most recent result
  during a temporary throttle, avoiding a blank error page. See [v1.md](v1.md).

Full writeup: [review2.md](review2.md).

## Path forward

- **Testnet / mainnet**: move from StudioNet to a funded GenLayer testnet, then mainnet, once
  ready to put real economic weight behind resolutions.
- **More evidence source types**: structured feeds (on-chain price oracles, sports APIs)
  alongside rendered web pages as additional evidence formats validators can fetch.
- **Community-created chains**: the Create flow already lets anyone build a market; next is
  category curation and a reputation system for chain creators.
- **Governance**: let token holders vote on protocol fee rates and confidence floors instead
  of a single owner key.

## Project structure

```
contracts/event_weaver.py      the Intelligent Contract (single, production)
backend/src/
  server.js                    Express app, never-die posture, health
  indexer.js                   chain → Postgres mirror (self-healing poller)
  resolver.js                  automatic deadline adjudication trigger
  routes.js / db.js / genlayer.js / config.js
frontend/src/
  pages/                       Landing, Markets, MarketDetail, Create, Portfolio
  components/                  Nav, Footer, MarketCard, ChainViz, Chips, Toast, Walkthrough, Logo
  lib/                         wallet (genlayer-js + MetaMask), api client, types, versionCheck (stale-build reload)
tests/direct/                  29 in-memory contract tests (gltest.direct)
docs/                          ARCHITECTURE · API · CONTRACT · DEPLOYMENT · images/
v1.md                          V1 USDC on Base Sepolia architecture and operations
.github/workflows/ci.yml       lint + tests + builds
MEMORY.md                      living decision log
SUBMISSION.md                  review submission summary
review.md                      authenticated-clock fix: request, root cause, fix, tests
review2.md                     "Failed to fetch" fix: stale-build detection, RPC rate-limit hardening
```

## Hard-won GenLayer lessons

Documented in [MEMORY.md](MEMORY.md) so nobody re-learns them the hard way. Highlights:

- Comment lines touching the `Depends` header corrupt the runner config → deploy
  "succeeds" but GenVM returns `invalid_contract` and the schema won't load.
- `TreeMap` keys must be Comparable (`u32`/`str`/`Address`); never instantiate
  `DynArray[...]()` — assign plain Python lists and let the SDK coerce.
- Studio/CLI auto-decode JSON-looking string args into lists — accept both.
- Use `gl.eq_principle.prompt_comparative` with an outcome-focused tolerance principle for
  all web/LLM results; `strict_eq` on non-deterministic output guarantees consensus failure.
- The CLI has no `--value` flag — payable calls go through genlayer-js
  (`writeContract({ …, value })`), and amounts must be BigInt, not strings.
- `datetime.datetime.now()` inside a contract is GenVM's authenticated block clock, patched
  identically for every validator — never accept a `now_ts`-style argument from calldata for
  anything time-gated; read it internally instead (see
  [Authenticated clock design](#authenticated-clock-design)).
- Fly Postgres (legacy Nomad and flex) does not terminate TLS on its private-network
  connections — the WireGuard mesh is the transport encryption. Forcing
  `ssl: { rejectUnauthorized: false }` on every non-`localhost` connection string breaks the
  DB silently (falls back to an in-memory mirror); only enable TLS when the URL explicitly
  requests it (`?sslmode=require`).

---

<div align="center">

Built on [GenLayer](https://www.genlayer.com/) · Optimistic Democracy consensus · StudioNet

</div>
