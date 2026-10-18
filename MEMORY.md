# EventWeaver — Project Memory

Living memory of decisions, gotchas, and state. Update this file whenever an
architectural decision is made or a hard-won lesson is learned.

> The active system uses GenLayer StudioNet for adjudication and Base Sepolia test USDC for
> custody. Treat [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md) as deployment evidence.

## What this project is
Causal-chain prediction markets on GenLayer. Users define an ordered chain of
dependent real-world events; an Intelligent Contract adjudicates the whole
chain against live web evidence via validator consensus. In V1, Base Sepolia test USDC moves
through an external escrow while GenLayer stores positions and computes final allocations.

## Architecture decisions (confirmed by owner)
- **Adjudication policy**: staking open to all until deadline; pre-deadline step checks restricted to market creator/platform owner; post-deadline adjudication permissionless AND auto-triggered by the backend resolver (`backend/src/resolver.js`, RESOLVER_PRIVATE_KEY optional).
- **Contract**: `contracts/event_weaver.py`, deployed to StudioNet at `0xB780213B7c1b47cd07913aC83f42371Be2E1bdD3`.
- **USDC custody**: `contracts/base/EventWeaverEscrow.sol`, deployed on Base Sepolia at `0xe9edA1549aFcaCB073C86668f84E2A619F4f50cD`, using test USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- **Constructor args**: `min_creation_bond=0`, `min_stake=0` for StudioNet.
- **Backend**: Node/Express indexer + API on **Fly.io**, 24/7 (`auto_stop_machines=off`, `min_machines_running=1`, restart policy). Database: **Fly Postgres**.
- **Frontend**: **Vite + React + Tailwind**, deployed to **Vercel**, with Vercel Analytics.
- **Auth**: **MetaMask / WalletConnect** wallet auth (no email/password, no custodial keys).
- **Notifications**: in-app only (indexer-driven activity feed).
- **CI**: GitHub Actions (contract lint + frontend/backend builds).
- Design system: "Causal Web" — dark glassmorphism, Logic Blue `#adc6ff`/`#4d8eff`, Adjudication Purple `#571bc1`, Emerald `#4edea3`; fonts Geist / Inter / JetBrains Mono. Source prototypes in `~/Documents/design/EventWeaver/` are reference, not copy-paste.

## V1 value-transfer path
1. The wallet approves test USDC and calls Base escrow `stake(market_id, side, amount)`.
2. The relay records each confirmed `Staked` log using `txHash:logIndex`; only the relay can call GenLayer `record_stake`.
3. On terminal resolution, the independent authority reads canonical GenLayer and Base state,
   verifies the finalized verdict and exact payout commitment, then signs it before the backend
   relayer calls `settle`.
4. A deposit that cannot be applied receives an independently signed `allocateDepositRefund` allocation bound to its original event-specific deposit id.
5. Each allocated wallet calls `claim(market_id)` to receive USDC directly.

## Hard-won GenLayer gotchas (do not re-learn these)
- **`Depends` header parsing**: GenVM treats the ENTIRE leading comment block as the runner JSON config. Any `#` comment line directly after `# { "Depends": ... }` corrupts it → deploy finalizes but GenVM returns `contract_error/invalid_contract` → Studio shows **"could not load contract schema"**. Fix: blank line immediately after the Depends line.
- **Runner hash**: use `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (the docs hash — maps to the std-lib WITH `gl.Contract`, `from genlayer import *`). The linter's "newer runner" suggestion `1zr6nqk…` maps to a lib WITHOUT those exports and breaks on StudioNet.
- **TreeMap keys** must be Comparable (`u32`, `str`, `Address`) — `u64` keys fail genvm-lint E018.
- **Studio/CLI auto-decodes JSON-looking string args into lists** before the contract sees them — accept both `str` and `list` for JSON params.
- **CLI has no `--value` flag on `write`** — payable calls must go through genlayer-js (`writeContract({..., value})`).
- **MetaMask must be switched to StudioNet (chain id 61999 / `0xf22f`) before any write**, or the wallet silently signs and submits the transaction on whichever chain it currently has selected (often Ethereum Mainnet) — it "succeeds" in MetaMask's UI but never reaches the real contract. genlayer-js's `assertChainMatch` skips this check entirely for Studio chains (`isStudio: true`), so the app itself must call `wallet_switchEthereumChain` (falling back to `wallet_addEthereumChain` on error code 4902) on connect AND before every write. Implemented in `frontend/src/lib/wallet.tsx` (`ensureStudioNetwork`).
- **Native transfers to a MetaMask/EOA wallet require the `@gl.evm.contract_interface` stub** (`_Recipient` with empty `View`/`Write` classes, then `_Recipient(Address(to)).emit_transfer(value=v)`). `gl.get_contract_at(addr).emit_transfer(...)` is the **IC-to-IC** path only — using it to pay out to a user's wallet silently does not move real balance. This was the root cause of "claim doesn't show in my wallet." Verified fix via `eth_getBalance` delta on a real EOA before/after withdraw.
- StudioNet has no `gen_dbg_traceTransaction`; debug via `genlayer receipt <tx> --stdout --stderr`.
- genvm-lint validate is broken when both SDK libs are on sys.path (imports old `genlayer` first). Validate schema manually against lib `11rhn002…`.
- Equivalence: use `gl.eq_principle.prompt_comparative` with a tolerant, outcome-focused principle (agree on booleans + confidence within 25 pts) to avoid leader rotation / Undetermined results. When timing is decision-critical, validators must also agree on the UTC occurrence date and whether it is before the event-occurrence deadline. Never `strict_eq` for web/LLM output.
- **A Base Sepolia escrow must never be reused across GenLayer contract redeployments.** Pools are keyed by integer `marketId`, and a new GenLayer contract restarts ids at zero. Always deploy a fresh escrow with `(usdc, relayer, settlementAuthority, genLayerContract)` and verify `pools(0)` is empty before wiring the pair together.
- **GenLayer contracts are immutable.** A fix means a new contract, new matched escrow, and synchronized Fly/Vercel configuration. When markets appear missing, compare `/health`, `/api/config`, the frontend bundle and on-chain `get_market_count` for the exact canonical address.

## Deployed state (live)
- **GenLayer V1 contract**: `0xB780213B7c1b47cd07913aC83f42371Be2E1bdD3`.
- **Base Sepolia escrow**: `0xe9edA1549aFcaCB073C86668f84E2A619F4f50cD`; test USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- **Backend**: https://eventweaver-api-v2.fly.dev (Fly app `eventweaver-api-v2` + Postgres `eventweaver-api-v2-db`). Its secrets include contract/escrow configuration, the transaction-only relayer key, and an authenticated private URL/token for the authority service. The authority signing key exists only in the separate `eventweaver-settlement-authority` Fly app.
- **Frontend**: https://eventweaver-orpin.vercel.app (Vercel project `eventweaver`; env `VITE_API_URL`, `VITE_CONTRACT_ADDRESS`, `VITE_BASE_ESCROW_ADDRESS`, `VITE_BASE_SEPOLIA_USDC`).
- **Repo**: https://github.com/zoefunds/Event-Weaver (main; GitHub Actions CI: contract lint + backend check + frontend build).
- If the owner deploys a new GenLayer contract: deploy a new Base escrow too (see gotcha above), then update the matching Fly secrets and Vercel environment variables, and redeploy both. Never add the relayer key to Vercel.
- The public market feed (`/api/markets`) no longer filters anything out — no hidden-id list, no status exclusion, no low pagination cap. If a market is missing, it's a contract-address mismatch or an indexer lag, not a filter.
- StudioNet quirks: `sim_fundAccount` RPC funds test accounts (wei units); other Studio users can and do interact with public contracts (expect foreign stakes/checks); `latest-nonfinal` reads can lag writes by ~15–30s.

## Review-team constraints (rewards)
One serious project; validators must verify actual outcomes (not JSON shape);
resolution must check real evidence via contract-side web fetching (it does:
`gl.nondet.web.render` inside the nondet block); submit full repo source.
