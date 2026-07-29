# Review: "Failed to fetch" on All Screens

## Request

> I get a "Failed to load markets: Failed to fetch" on all screens

## Status: Resolved

## The problem

Two distinct, compounding issues surfaced under this one symptom.

### 1. Stale client-side builds after the backend/database migration

The backend and its Postgres database were migrated to a new Fly.io account/app
(`eventweaver-api-prod` / `eventweaver-db-prod`) after the original account was
retired. Once the old account was deleted, its backend host
(`eventweaver-api.fly.dev`) stopped resolving entirely:

```
$ curl https://eventweaver-api.fly.dev/health
curl: (6) Could not resolve host: eventweaver-api.fly.dev
```

Every frontend page (`Landing`, `Markets`, `MarketDetail`, `Create`, `Portfolio`)
calls this API URL, which is baked into the JS bundle at build time
(`VITE_API_URL`). A browser tab that was already open — or one still holding
an old cached bundle — from *before* the migration kept running that old code
indefinitely. Every fetch to the dead host failed instantly with the browser's
generic `TypeError: Failed to fetch`, on every single screen, with nothing in
the UI to explain why.

The live, current deployment was (and is) healthy the whole time — this was
purely a stale-client problem, not a server outage.

### 2. StudioNet's RPC rate limit (30 requests/minute)

Investigating a related report ("Could not load portfolio" specifically)
turned up a second, independent problem: StudioNet's RPC endpoint caps at **30
requests/minute**, shared across every consumer of the same contract address —
the background indexer, the auto-resolver, and every live-reading API route.

- The indexer alone cost `2 + 2×markets` live reads every **15 seconds** — at
  just 4 markets that's already **40 reads/minute from background polling
  alone**, before a single user loads a page.
- `/api/portfolio/:address` did `2 + 3×positions` live reads per request, with
  zero caching — a wallet with 4 positions costs 14 reads in one HTTP call.
- `/api/config` re-read `get_config` + `get_categories` live from the chain
  on *every* page load, despite that data being effectively static.

A reload firing config, stats, markets, and portfolio requests concurrently —
on top of the indexer's own chronic over-budget polling — could tip the
shared 30/min budget over, and the affected request failed outright with no
retry.

## The fix

**Stale-build detection and self-healing**
([frontend/src/lib/versionCheck.ts](frontend/src/lib/versionCheck.ts)):

- Every tab captures the script hash of the bundle it booted with.
- Every 5 minutes, it re-fetches `/` (`cache: 'no-store'`) and compares the
  bundle hash referenced in the fresh HTML.
- After two consecutive mismatches (to avoid reacting to a transient partial
  CDN invalidation), it clears `localStorage`/`sessionStorage` and calls
  `window.location.reload()` — so a tab open across a future migration
  self-heals within minutes instead of failing forever.
- Wired in at boot via `frontend/src/main.tsx`.

**RPC rate-limit hardening**
([backend/src/genlayer.js](backend/src/genlayer.js),
[backend/src/routes.js](backend/src/routes.js),
[backend/fly.toml](backend/fly.toml)):

- `readContract` now retries rate-limit errors up to 3 times with exponential
  backoff (500ms / 1s / 2s) instead of letting the error propagate straight to
  the caller.
- `/api/config` is cached for 5 minutes — routine page loads now cost 0 RPC
  reads for this endpoint instead of 2.
- `/api/portfolio/:address` is cached per-address for 10 seconds — the exact
  "reload instantly" scenario is now served from cache with 0 additional RPC
  reads.
- The indexer's poll interval moved from 15s to 45s
  (`POLL_INTERVAL_MS` in `fly.toml`), cutting its own background RPC
  consumption from ~40/min to ~13/min at the current market count and leaving
  real headroom under the shared cap for the resolver and actual user
  requests.

## Verification

**Root cause confirmed directly:**

```
$ curl https://eventweaver-api.fly.dev/health
curl: (6) Could not resolve host: eventweaver-api.fly.dev   # old host: dead

$ curl -H "Origin: https://eventweaver-orpin.vercel.app" https://eventweaver-api-prod.fly.dev/health
{"ok":true,"db":"up", ...}   # current host: healthy, correct CORS
```

**Stale-build fix**, confirmed in the deployed bundle:

```
$ curl -s https://eventweaver-orpin.vercel.app/assets/index-*.js | grep -c localStorage.clear
2
```

**Rate-limit fix**, confirmed with a realistic reload simulation (single
requests, not an artificial burst) immediately after deploying the fix:

```
round 1 — portfolio: 200 (6.7s — hit the rate limit internally, self-healed via retry)
round 1 — config:    200 (2.2s)
round 1 — markets:   200 (1.1s)
round 2 — portfolio: 200 (0.99s — served from cache)
round 2 — config:    200 (0.93s)
round 2 — markets:   200 (1.0s)
```

No request failed. The 6.7s round-1 portfolio call shows the retry path
actually engaging and recovering — invisible to the end user, where before
this would have been a hard "Could not load portfolio" failure.

Full contract test suite unaffected and still green:

```
$ pytest tests/direct/test_event_weaver.py -q
29 passed
```

## Honest caveat

This is a mitigation, not a structural fix for the underlying "read
everything live, every time" pattern in `/api/portfolio`. It is sized for
current usage (a handful of markets and positions). If market/position counts
or concurrent traffic grow substantially, the fixed 30 req/min ceiling will
need a real pagination/caching redesign rather than short-TTL caching and
backoff — this fix buys headroom, it doesn't remove the ceiling.

## Files touched

- `frontend/src/lib/versionCheck.ts` (new)
- `frontend/src/main.tsx`
- `backend/src/genlayer.js`
- `backend/src/routes.js`
- `backend/fly.toml`
