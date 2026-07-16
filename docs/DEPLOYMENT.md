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
fly launch --no-deploy --copy-config --name eventweaver-api
fly postgres create --name eventweaver-db --region iad
fly postgres attach eventweaver-db --app eventweaver-api   # sets DATABASE_URL
fly secrets set CONTRACT_ADDRESS=0x... CORS_ORIGINS=https://your-frontend.vercel.app
fly deploy
curl https://eventweaver-api.fly.dev/health
```

`fly.toml` enforces the never-die posture: `auto_stop_machines="off"`,
`min_machines_running=1`, restart policy `always`, `/health` checks every 15s.

## 3. Frontend → Vercel

```bash
cd frontend
vercel --prod \
  -e VITE_API_URL=https://eventweaver-api.fly.dev \
  -e VITE_CONTRACT_ADDRESS=0x...
```

SPA rewrites are configured in `vercel.json`. Vercel Analytics is wired via
`@vercel/analytics` in `App.tsx`.

## 4. Rotating the contract address

Set `CONTRACT_ADDRESS` (Fly secret) and `VITE_CONTRACT_ADDRESS` (Vercel env) and redeploy
both. No code changes required.
