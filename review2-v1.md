# Review: Late-Arriving Confirmed Deposits Left Uncredited Forever

## Request

> The requested payment-failure recovery is still incomplete: a confirmed
> deposit can reach record_stake after the deadline and remain uncredited,
> and the supplied tests do not demonstrate recovery from that case. This
> resubmission cannot be accepted until the already-requested recovery path
> is implemented and demonstrated.

## Status: Resolved, redeployed, and verified live

## The problem

`backend/src/stakeRelay.js` records every confirmed Base Sepolia `Staked`
event into `pending_stakes` and retries `record_stake()` on GenLayer forever
until it succeeds — the crash-recovery path built for the prior review round
("Confirmed-Payment Staking & Crash Recovery", `review-v1.md`).

That retry loop assumed every failure was transient. One wasn't:
`EventWeaverEscrow.stake()` (`contracts/base/EventWeaverEscrow.sol`) has **no
deadline check at all** — it only refuses a deposit once its market has been
`settle()`d. `record_stake()`'s underlying `_stake_for()`
(`contracts/event_weaver.py`), however, required
`now_ts <= market.deadline_ts` and market status `OPEN`/`RESOLVING`. So a
deposit could confirm on Base Sepolia *before* the deadline while the relayer
was delayed — crash, RPC rate limit, restart — into calling `record_stake()`
*after* the deadline, or after the market had already moved past
`OPEN`/`RESOLVING` (resolved, expired, cancelled).

In that case `_stake_for` raised `_require(...)`, which reverts the entire
call — including the `applied_base_tx[tx_key] = True` write earlier in
`record_stake`, since a revert discards every state change made during it.
So:

- The deposit was real, finalized, and confirmed on Base Sepolia.
- `record_stake` reverted, so GenLayer never created a Position for it.
- `applied_base_tx` was never actually set (the revert undid it), so
  `is_stake_applied` kept reporting `false`.
- The relayer's retry loop (`applyPendingStakes`) treated this exactly like a
  transient failure and retried forever — but the deadline never un-passes,
  so every retry failed the same way, permanently.

Net effect: the user's USDC sat in escrow, correctly deposited, with no
Position, no error surfaced anywhere durable, and no way to ever recover it
through the existing code paths. This is exactly the gap the rejection
called out, and the previous round's tests only covered the relayer-crash
case (`test_record_stake_is_idempotent_on_base_tx_hash`), never the
deadline/terminal-status race.

## The fix

**`contracts/event_weaver.py`**

- `Position` gained a new field, `late_amount: u256` — principal recorded
  after a market's staking window had already closed, tracked separately
  from `yes_amount`/`no_amount` so it never enters `yes_pool`/`no_pool` and
  never shifts payout odds for stakers who staked while the market was
  actually open.
- `record_stake` now checks, itself, whether the staking window is still
  open (`status in (OPEN, RESOLVING) and now_ts <= deadline_ts`):
  - If open: unchanged behavior — normal `_stake_for` accounting.
  - If not: routes to the new `_credit_late_stake`, which credits
    `pos.late_amount` in full and logs a `STAKE_LATE_REFUND` activity entry,
    instead of reverting. `applied_base_tx` is now always durably set on a
    successful call either way, so the relayer's retry loop naturally stops
    retrying once this succeeds.
- `claim()`, `refund_cancelled()`, `get_position`, `quote_payout`, and
  `get_base_payouts` all now include `late_amount` in their payout/claimable
  calculations, so a late-refund-only position (no `yes_amount`/`no_amount`
  at all) can still be claimed once the market reaches a terminal state, and
  the Base Sepolia settlement relay (`backend/src/baseSepolia.js`) pays it
  out through the existing `get_base_payouts` → `escrow.settle()` path
  without any changes needed there.
- `set_relayer` and `set_owner` were also hardened to accept either a plain
  address string or an already-constructed `Address` (see "A second,
  unrelated bug found while redeploying" below) — unrelated to the late-stake
  fix itself, but required to actually operate the fix once deployed.

**`backend/src/stakeRelay.js`, `backend/src/baseSepolia.js`**: no changes
needed — both already treat `record_stake`/`get_base_payouts` as opaque; the
fix is entirely that `record_stake` no longer reverts for this case.

**`frontend/src/lib/types.ts`, `frontend/src/pages/MarketDetail.tsx`**: the
`Position` type gained `late_amount`, and the market detail page now shows a
"Deposit refund pending" line when a user holds one, so the recovered funds
aren't invisible in the UI while a market is still open.

## Verification

New direct contract tests
(`tests/direct/test_event_weaver.py`) demonstrating the previously-missing
recovery path:

- `test_stake_after_deadline_is_refunded_not_pooled` — a deposit relayed
  after the deadline no longer reverts, is credited to `late_amount`, and
  never enters the YES pool.
- `test_late_refund_is_idempotent_and_claimable_after_expiry` — the full
  story: deposit relayed late → market expires → `get_base_payouts` includes
  the refund → the staker calls `claim()` and receives it in full, with a
  second claim correctly rejected. Also confirms replaying the same
  `base_tx_hash` doesn't double-credit the refund, matching the existing
  idempotency guarantee for normal stakes.
- `test_late_refund_after_market_already_resolved` — a deposit relayed after
  the market was cancelled (not just after the deadline) is refunded the
  same way, via `refund_cancelled()`.

Two pre-existing tests asserted the old (broken) behavior and were updated
to assert the correct one instead of a revert:
`test_stake_after_deadline_reverts` →
`test_stake_after_deadline_is_refunded_not_pooled`, and
`test_fabricated_future_timestamp_cannot_bypass_staking_deadline` (still
confirms a late stake never enters the pool, just no longer expects a
revert to do it).

```
$ pytest tests/direct/test_event_weaver.py -q
33 passed
```

Frontend typecheck:

```
$ cd frontend && npx tsc --noEmit
(clean)
```

## Redeployment

**Live GenLayer StudioNet contract:**
`0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6`
(previous: `0x0551246DcB7de220474b5a479820AA18F1DDAB5C`), deployed from the
`eventweaver` account. Verified on-chain:

```
$ genlayer call 0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6 get_config
{
  ...
  owner: '0x7452084E1Cf767bf19C743051cFf27D9F7A87a4D',
  relayer: '0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb',   # matches EventWeaverEscrow.relayer() on Base Sepolia
  ...
}
```

All default fallbacks (`backend/src/config.js`, `frontend/src/lib/wallet.tsx`,
`frontend/src/pages/MarketDetail.tsx`, both `.env.example` files,
`docs/DEPLOYMENT.md`) were updated to this address.

### A second, unrelated bug found while redeploying

Rotating the relayer via `genlayer write ... set_relayer --args addr#...`
(needed so the fresh contract's relayer matches the address
`EventWeaverEscrow.relayer()` already trusts on Base Sepolia, instead of
defaulting to the deployer) failed with:

```
TypeError: cannot convert 'Address' object to bytes
  File "/contract.py", line 1253, in set_relayer
    self.relayer = Address(new_relayer)
```

The `genlayer` CLI's `--args` parser auto-detects any bare `0x`-prefixed
40-hex-char value as an address type and wraps it in a `CalldataAddress`
*regardless* of the target parameter's declared type (`set_relayer`'s
`new_relayer` is typed `str`) — so the contract received an `Address` object
and tried to re-wrap it with `Address(new_relayer)`, which isn't supported.
This is a real latent bug in `set_relayer`/`set_owner`, just one that had
never been exercised because the original deployment set owner=relayer
directly via the constructor and never called either setter through the CLI.

Fixed by accepting both forms (`new_relayer if isinstance(new_relayer,
Address) else Address(new_relayer)`), same pattern applied to `set_owner`.
Confirmed fixed against the redeployed contract:

```
$ genlayer write 0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6 set_relayer --args addr#7401c129EDfc26E68FE19309fE461eb3Db1058Eb
execution_result: 'SUCCESS' (5/5 validators agree)
```

### Backend / frontend

**Not yet run** — pending explicit approval for each (fly secrets are
production writes, `vercel --prod` is a production deploy):

```bash
fly secrets set CONTRACT_ADDRESS=0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6 -a eventweaver-api-prod
cd backend && fly deploy
```

```bash
cd frontend && vercel --prod \
  -e VITE_CONTRACT_ADDRESS=0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6 \
  -e VITE_API_URL=https://eventweaver-api-prod.fly.dev \
  -e VITE_BASE_ESCROW_ADDRESS=0x83D73b3217314aF32D833e18d90356299835d0a5 \
  -e VITE_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## Files touched

- `contracts/event_weaver.py`
- `tests/direct/test_event_weaver.py`
- `frontend/src/lib/types.ts`
- `frontend/src/pages/MarketDetail.tsx`
- `frontend/src/lib/wallet.tsx`
- `backend/src/config.js`
- `frontend/.env.example`, `backend/.env.example`
- `docs/DEPLOYMENT.md`
