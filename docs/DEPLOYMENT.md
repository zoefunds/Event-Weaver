# Deployment Guide

## 1. Intelligent Contract → GenLayer StudioNet

```bash
npm install -g genlayer
genlayer network set studionet
genlayer account create --name eventweaver
genlayer account unlock --account eventweaver
genlayer deploy --contract contracts/event_weaver.py --args 0 0
```

Constructor args: `min_creation_bond=0`, `min_stake=0` (StudioNet). Verify:

```bash
genlayer schema <ADDRESS>          # must print full method schema
genlayer call <ADDRESS> get_config
```

**Critical**: the `# { "Depends": ... }` line must be line 1 with a **blank line after it** —
any comment touching it corrupts the runner header and yields
`invalid_contract` / "could not load contract schema".

## 2. Independent authority → Fly.io

The authority must be a separate service and the only process that holds the signing key. It
independently verifies finalized GenLayer state, the canonical contract and market, Base receipt
logs, pending liabilities, recipients and amounts before returning a signature.

```bash
cd authority
fly deploy -a eventweaver-settlement-authority
fly secrets set -a eventweaver-settlement-authority \
  GENLAYER_CONTRACT_ADDRESS=0xEA4a86A6b477a5552F7B149a646f25c756653657 \
  BASE_ESCROW_ADDRESS=0xd84ec8bf005f7159F91118Cae80868D1F1Fd3f18 \
  SETTLEMENT_AUTHORITY_PRIVATE_KEY=<authority-only-key> \
  AUTHORITY_API_TOKEN=<shared-api-token>
```

Never copy `SETTLEMENT_AUTHORITY_PRIVATE_KEY` into the backend application.

## 3. Backend → Fly.io (24/7)

```bash
cd backend
fly launch --no-deploy --copy-config --name eventweaver-api-v2
fly postgres create --name eventweaver-api-v2-db --region iad
fly postgres attach eventweaver-api-v2-db --app eventweaver-api-v2   # sets DATABASE_URL
fly secrets set CONTRACT_ADDRESS=0xEA4a86A6b477a5552F7B149a646f25c756653657 \
  GENLAYER_CONTRACT_ADDRESS=0xEA4a86A6b477a5552F7B149a646f25c756653657 \
  BASE_ESCROW_ADDRESS=0xd84ec8bf005f7159F91118Cae80868D1F1Fd3f18 \
  BASE_ESCROW_DEPLOYMENT_BLOCK=48282047 \
  BASE_SEPOLIA_RELAYER_PRIVATE_KEY=<throwaway-relayer-key> \
  SETTLEMENT_SIGNER_URL=http://eventweaver-settlement-authority.internal:8080 \
  SETTLEMENT_SIGNER_TOKEN=<shared-api-token> \
  POLL_INTERVAL_MS=300000 \
  RESOLVER_INTERVAL_MS=300000 \
  CORS_ORIGINS=https://eventweaver-orpin.vercel.app
fly deploy
curl https://eventweaver-api-v2.fly.dev/health
```

`fly.toml` enforces the never-die posture: `auto_stop_machines="off"`,
`min_machines_running=1`, restart policy `always`, and `/health` checks. The indexer,
resolver, and settlement relay poll every five minutes to stay below the shared StudioNet RPC budget.

## 4. Frontend → Vercel

```bash
cd frontend
vercel --prod \
  -e VITE_API_URL=https://eventweaver-api-v2.fly.dev \
  -e VITE_CONTRACT_ADDRESS=0x3b1781e005AEEf7ec64A51a8DFA323A16aAa0a6f \
  -e VITE_BASE_ESCROW_ADDRESS=0xd1c6864eCE3f06B1a18932905ab816635726040c \
  -e VITE_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

SPA rewrites are configured in `vercel.json`. Vercel Analytics is wired via
`@vercel/analytics` in `App.tsx`.

## 5. Rotating the contract address

Set the matching GenLayer address in `CONTRACT_ADDRESS` (Fly) and
`VITE_CONTRACT_ADDRESS` (Vercel), then set the Base escrow variables shown above and redeploy
both. The relayer key belongs only in Fly secrets, never in the frontend.

**Deploy a new escrow alongside a new GenLayer contract — never reuse the old one.**
`EventWeaverEscrow` tracks pools by a plain `marketId` integer with no knowledge of which
GenLayer contract deployment that id came from. Since GenLayer contract market ids always
start at 0, pointing a new contract at an existing escrow will collide with whatever that
escrow already recorded for the same ids — `stake()` reverts outright for an id the old
contract already settled, and silently mixes deposits for an id the old contract used but
never settled. Deploy a fresh escrow with (`usdc`, `relayer`, `settlementAuthority`,
`genLayerContract`) for
every new contract address:

```bash
forge create contracts/base/EventWeaverEscrow.sol:EventWeaverEscrow \
  --rpc-url https://sepolia.base.org \
  --private-key <relayer-key> \
  --broadcast \
  --constructor-args <usdc-address> <relayer-address> <settlement-authority-address> <genlayer-address>
```

Verify `pools(0)` on the new address is `(0, 0, 0, false)` before wiring it in.

The current escrow source also makes the relayer and settlement-authority constructor values
immutable. There are deliberately no role-rotation setters. Market registration now signs the
GenLayer staking deadline, and deposit acknowledgements/refunds sign the exact YES/NO side.
Deploy the authority and backend versions from the same source revision: their ABI payloads must
match this escrow exactly. The backend records each finalized resolver transaction hash and the
authority verifies that exact successful, final GenVM transaction before signing Base settlement.

## 6. Canonical production deployment

The currently reviewed pair is GenLayer `0x3b1781e005AEEf7ec64A51a8DFA323A16aAa0a6f`
with Base escrow `0xd1c6864eCE3f06B1a18932905ab816635726040c`. Deployment transactions,
finalized GenVM receipts, settlement proof, and before/after USDC balances are recorded in
[`REMEDIATION_ACCEPTANCE.md`](../REMEDIATION_ACCEPTANCE.md). The Fly backend and Vercel
frontend are deployed with this exact pair.
