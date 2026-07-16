# EventWeaver — Submission

**Prediction markets for chain reactions, not isolated events** — trustless causal-chain
adjudication on GenLayer.

## Links

| | |
| --- | --- |
| **Live app** | https://eventweaver-orpin.vercel.app |
| **API (24/7)** | https://eventweaver-api.fly.dev/health |
| **Source (full repo)** | https://github.com/zoefunds/Event-Weaver |
| **Intelligent Contract (StudioNet)** | `0xa91447f7609aFA2B4dc81D1eBF6d1F67bec1bB80` |

## What it does

A market is an **ordered chain** of dependent real-world conditions (2–12 steps), e.g.
*Apple cuts Vision Pro price → Meta cuts Quest price within 30 days*. It resolves YES only if
**every** step verifiably occurred, in order. Users stake native GEN on YES/NO; winners split
the losing pool pro-rata; winnings withdraw as real native transfers.

## Why this needs GenLayer (and can't be an off-chain AI app)

Resolution is a **trust problem**, not an inference problem. The party who resolves a market
controls the money — so resolution must be decentralized, and the evidence must be verified
inside consensus, not asserted by a server:

- **Contract-side web fetching**: at adjudication time, each validator independently renders
  the market's declared evidence URLs (`gl.nondet.web.render`) *inside GenVM* — news pages,
  official announcements, filings. No off-chain oracle feed, no user-submitted claims.
- **Validator reasoning, not format checking**: validators don't compare JSON shapes — the
  equivalence principle (`gl.eq_principle.prompt_comparative`) requires them to agree on the
  **actual outcome** (occurred / can-still-occur booleans, confidence within 25 pts) after
  each has done its own fetch + LLM reasoning over the evidence.
- **Consensus-stable by design**: verdicts are coarse (bucketed confidence, sticky FULFILLED
  states, inconclusive-stays-PENDING), so honest validators converge — verified live on
  StudioNet: full-round `MAJORITY_AGREE`, zero leader rotations, zero Undetermined results.
- **Transparent**: every step's reasoning and evidence summary is stored on-chain and shown
  in the UI's resolution report.

## Real value-transfer path

`stake_yes`/`stake_no`/`deposit` are payable (native GEN moves into the contract via
`gl.message.value`) → `claim` credits stake + pro-rata share of the losing pool (1% protocol
+ 0.5% creator fee) → `withdraw` emits an actual native transfer back to the caller
(`emit_transfer(..., on='finalized')`). Exercised end-to-end on StudioNet.

## Adjudication lifecycle

Staking is open to everyone until the deadline. Pre-deadline step checks are restricted to
the market creator (progressive verification of long chains). After the deadline,
adjudication is permissionless **and automatic** — the always-on backend resolver triggers
`request_resolution`; an undecided chain expires to NO deterministically.

## Quality evidence

- `genvm-lint` 3/3 clean; on-chain `genlayer schema` loads (35 methods).
- **24 direct unit tests** (`pytest tests/direct/`, gltest.direct with mocked web/LLM):
  creation validation, payable staking, settlement math incl. fees, adjudication verdict
  handling (high-confidence, chain-break, inconclusive, malformed LLM output), permission
  gates, cancellation/refunds, admin controls.
- Live StudioNet integration: real evidence fetch of `apple.com/newsroom`, correct
  low-confidence PENDING verdict, one-round consensus; payable stake, deposit, withdraw all
  executed on-chain.
- CI (GitHub Actions): contract lint + direct tests + backend check + frontend build.
