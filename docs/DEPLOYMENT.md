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

## 2. Backend → Fly.io (24/7)

```bash
cd backend
fly launch --no-deploy --copy-config --name eventweaver-api-prod
fly postgres create --name eventweaver-db-new --region iad
fly postgres attach eventweaver-db-new --app eventweaver-api-prod   # sets DATABASE_URL
fly secrets set CONTRACT_ADDRESS=0x96727fd9E35036903B89829E1349dB5A83e7c48f \
  BASE_ESCROW_ADDRESS=0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C \
  BASE_SEPOLIA_RELAYER_PRIVATE_KEY=<throwaway-relayer-key> \
  POLL_INTERVAL_MS=300000 \
  RESOLVER_INTERVAL_MS=300000 \
  CORS_ORIGINS=https://eventweaver-orpin.vercel.app
fly deploy
curl https://eventweaver-api-prod.fly.dev/health
```

`fly.toml` enforces the never-die posture: `auto_stop_machines="off"`,
`min_machines_running=1`, restart policy `always`, and `/health` checks. The indexer,
resolver, and settlement relay poll every five minutes to stay below the shared StudioNet RPC budget.

## 3. Frontend → Vercel

```bash
cd frontend
vercel --prod \
  -e VITE_API_URL=https://eventweaver-api-prod.fly.dev \
  -e VITE_CONTRACT_ADDRESS=0x96727fd9E35036903B89829E1349dB5A83e7c48f \
  -e VITE_BASE_ESCROW_ADDRESS=0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C \
  -e VITE_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

SPA rewrites are configured in `vercel.json`. Vercel Analytics is wired via
`@vercel/analytics` in `App.tsx`.

## 4. Rotating the contract address

Set the matching GenLayer address in `CONTRACT_ADDRESS` (Fly) and
`VITE_CONTRACT_ADDRESS` (Vercel), then set the Base escrow variables shown above and redeploy
both. The relayer key belongs only in Fly secrets, never in the frontend.
