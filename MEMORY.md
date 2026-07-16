# EventWeaver — Project Memory

Living memory of decisions, gotchas, and state. Update this file whenever an
architectural decision is made or a hard-won lesson is learned.

## What this project is
Causal-chain prediction markets on GenLayer. Users define an ordered chain of
dependent real-world events; an Intelligent Contract adjudicates the whole
chain against live web evidence via validator consensus, and native tokens
move through payable stakes, claims, and withdrawals.

## Architecture decisions (confirmed by owner)
- **Contract**: single Intelligent Contract `contracts/event_weaver.py`, deployed to **StudioNet** (gasless, GEN token). Owner deploys it themselves and supplies the address.
- **Constructor args**: `min_creation_bond=0`, `min_stake=0` for StudioNet.
- **Backend**: Node/Express indexer + API on **Fly.io**, 24/7 (`auto_stop_machines=off`, `min_machines_running=1`, restart policy). Database: **Fly Postgres**.
- **Frontend**: **Vite + React + Tailwind**, deployed to **Vercel**, with Vercel Analytics.
- **Auth**: **MetaMask / WalletConnect** wallet auth (no email/password, no custodial keys).
- **Notifications**: in-app only (indexer-driven activity feed).
- **CI**: GitHub Actions (contract lint + frontend/backend builds).
- Design system: "Causal Web" — dark glassmorphism, Logic Blue `#adc6ff`/`#4d8eff`, Adjudication Purple `#571bc1`, Emerald `#4edea3`; fonts Geist / Inter / JetBrains Mono. Source prototypes in `~/Documents/design/EventWeaver/` are reference, not copy-paste.

## Value-transfer path (the real token movements)
1. `stake_yes` / `stake_no` / `deposit` are `@gl.public.write.payable` — the chain moves attached native value into the contract (`gl.message.value`).
2. `claim(market_id)` credits winnings (stake + pro-rata share of losing pool minus fees) to an internal balance.
3. `withdraw(amount)` emits a **real native transfer** from contract to caller via `emit_transfer(value=..., on='finalized')`.
4. Creator fee (0.5%) and protocol fee (1%) are carved from the losing pool; creation bond returned on clean resolution.

## Hard-won GenLayer gotchas (do not re-learn these)
- **`Depends` header parsing**: GenVM treats the ENTIRE leading comment block as the runner JSON config. Any `#` comment line directly after `# { "Depends": ... }` corrupts it → deploy finalizes but GenVM returns `contract_error/invalid_contract` → Studio shows **"could not load contract schema"**. Fix: blank line immediately after the Depends line.
- **Runner hash**: use `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (the docs hash — maps to the std-lib WITH `gl.Contract`, `from genlayer import *`). The linter's "newer runner" suggestion `1zr6nqk…` maps to a lib WITHOUT those exports and breaks on StudioNet.
- **TreeMap keys** must be Comparable (`u32`, `str`, `Address`) — `u64` keys fail genvm-lint E018.
- **Studio/CLI auto-decodes JSON-looking string args into lists** before the contract sees them — accept both `str` and `list` for JSON params.
- **CLI has no `--value` flag on `write`** — payable calls must go through genlayer-js (`writeContract({..., value})`).
- StudioNet has no `gen_dbg_traceTransaction`; debug via `genlayer receipt <tx> --stdout --stderr`.
- genvm-lint validate is broken when both SDK libs are on sys.path (imports old `genlayer` first). Validate schema manually against lib `11rhn002…`.
- Equivalence: use `gl.eq_principle.prompt_comparative` with a tolerant, outcome-focused principle (agree on booleans + confidence within 25 pts) to avoid leader rotation / Undetermined results. Never `strict_eq` for web/LLM output.

## Deployed state (live)
- **Contract (StudioNet)**: `0x40891b05D24BFaDD04D34d71d0e434C9183d096b` (deployer `0x7452084E1Cf767bf19C743051cFf27D9F7A87a4D`, CLI account `eventweaver`). Seeded with 2 demo markets; verified: create, payable stake, deposit/withdraw, live web adjudication (MAJORITY_AGREE, no rotation).
- **Backend**: https://eventweaver-api.fly.dev (Fly app `eventweaver-api` + Postgres `eventweaver-db`, iad, 24/7). Secrets: `CONTRACT_ADDRESS`, `DATABASE_URL`, `CORS_ORIGINS`.
- **Frontend**: https://eventweaver-orpin.vercel.app (Vercel project `eventweaver`, scope adebiyi2002gmailcoms-projects; env `VITE_API_URL`, `VITE_CONTRACT_ADDRESS`).
- **Repo**: https://github.com/zoefunds/Event-Weaver (main; GitHub Actions CI: contract lint + backend check + frontend build).
- If the owner deploys their own contract address: `fly secrets set CONTRACT_ADDRESS=0x… -a eventweaver-api`, update the two Vercel envs, redeploy both.
- StudioNet quirks: `sim_fundAccount` RPC funds test accounts (wei units); other Studio users can and do interact with public contracts (expect foreign stakes/checks); `latest-nonfinal` reads can lag writes by ~15–30s.

## Review-team constraints (rewards)
One serious project; validators must verify actual outcomes (not JSON shape);
resolution must check real evidence via contract-side web fetching (it does:
`gl.nondet.web.render` inside the nondet block); submit full repo source.
