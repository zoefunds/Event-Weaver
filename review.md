# Review: Authenticated Clock for Staking, Adjudication, Expiry & Settlement

## Request

> Please replace caller-supplied time in staking, adjudication rights, expiry, and
> settlement with an authenticated contract-verifiable clock design. Add adversarial
> tests proving that fabricated future or stale timestamps cannot change betting
> access or force a payout.

## Status: Resolved

## The problem

Every state-changing method on `EventWeaver` (`create_market`, `stake_yes`,
`stake_no`, `stake_from_balance`, `claim`, `refund_cancelled`, `cancel_market`,
`check_step`, `request_resolution`, `expire_market`) took a `now_ts: int`
argument supplied directly by the transaction sender. That value drove every
time-sensitive decision in the contract:

- **Staking access** — whether the market's deadline had passed
  (`_stake`: `now_ts <= market.deadline_ts`)
- **Adjudication rights** — whether pre-deadline (creator/owner-only) or
  post-deadline (permissionless) rules applied
  (`_require_adjudication_rights`: `now_ts > market.deadline_ts`)
- **Expiry** — whether a market could be force-expired to NO
  (`expire_market`: `now_ts > market.deadline_ts`)
- **Settlement** — the timestamp stamped on `resolved_ts`, `checked_at_ts`,
  and activity-log entries at finalization

Because `now_ts` came from calldata, any caller could pass a fabricated
value: a future timestamp to unlock permissionless adjudication or expiry
early, or a stale timestamp to keep staking open past a real deadline or to
stall expiry indefinitely. Nothing in the contract cross-checked the claim
against anything authoritative.

## The fix

GenVM (the GenLayer contract runtime) patches `datetime.datetime.now()`
inside a running contract to return the network's block time — a value every
validator computes identically as part of consensus, not something read from
calldata. This is confirmed directly in the SDK's test harness
(`gltest/direct/vm.py`), where `VMContext.activate()` installs a
`_WarpedDatetime` subclass so `datetime.now()` returns the harness's
consensus-controlled clock (`vm.warp(...)`) rather than wall-clock time or
any caller input.

**[contracts/event_weaver.py](contracts/event_weaver.py)**

- Removed the `now_ts: int` parameter from every public write method.
- Added `_now_ts()`:

  ```python
  def _now_ts(self) -> int:
      """Authenticated, consensus-agreed clock. GenVM patches
      datetime.now() to the network's block time, which every validator
      computes identically — it is never read from caller-supplied
      arguments or calldata, so it cannot be spoofed by a transaction
      sender to fabricate a future or stale time."""
      return int(datetime.datetime.now(datetime.timezone.utc).timestamp())
  ```

- Every method that previously received `now_ts` now computes it internally
  via `self._now_ts()` at the top of the call, before any time-gated check
  runs. This covers all four areas named in the request:
  - **Staking** — `_stake()` (shared by `stake_yes`, `stake_no`,
    `stake_from_balance`) checks the deadline against `self._now_ts()`.
  - **Adjudication rights** — `check_step()` and `request_resolution()`
    pass `self._now_ts()` into `_require_adjudication_rights()`.
  - **Expiry** — `expire_market()` checks `self._now_ts() > deadline_ts`.
  - **Settlement** — `_maybe_finalize()` and `_apply_verdict_to_step()`
    stamp `resolved_ts` / `checked_at_ts` from the same authenticated value,
    and `create_market()`, `claim()`, `refund_cancelled()`,
    `cancel_market()` all source their logged timestamps the same way.

No caller, including the market creator or platform owner, can influence
this value.

## Adversarial tests

Added to **[tests/direct/test_event_weaver.py](tests/direct/test_event_weaver.py)**,
using `vm.warp(iso_timestamp)` — the SDK's sanctioned way to control the
consensus clock in tests (standing in for real block time) — instead of the
now-removed caller argument:

| Test | Proves |
| --- | --- |
| `test_time_argument_no_longer_accepted_by_any_write` | A caller who still tries to smuggle a timestamp positional argument into `stake_yes`, `claim`, `expire_market`, or `request_resolution` is rejected outright — the spoofable parameter no longer exists in the ABI at all. |
| `test_fabricated_future_timestamp_cannot_open_early_adjudication_rights` | A non-creator, non-owner caller cannot unlock permissionless adjudication early; only the real (warped) consensus clock crossing the deadline does that. |
| `test_fabricated_future_timestamp_cannot_bypass_staking_deadline` | Staking is refused the instant the *real* clock crosses the deadline — independent of anything the caller could have claimed pre-fix. |
| `test_fabricated_stale_timestamp_cannot_delay_or_avoid_expiry` | `expire_market()` cannot be stalled by a caller claiming "it's not deadline yet" — it tracks the real clock only. |
| `test_payout_amount_is_independent_of_any_caller_timing_claim` | Claim payout math is unaffected no matter how far the (real) clock has advanced before claiming — settlement amounts depend only on pool sizes and the fee schedule, never on elapsed-time claims. |

All 5 pass alongside the full existing suite (unmodified in intent, just
updated to the new call signatures and `vm.warp()`).

## Verification

```
$ pytest tests/direct/test_event_weaver.py -v
...
29 passed
```

- `genvm-lint` schema unaffected (methods just have one fewer parameter).
- Live-deployed and manually verified against StudioNet on the new contract
  (`0x0361b5a160637407e7D93Ff8C1CC866855dD0cc2`): create → stake → claim →
  withdraw all confirmed working end-to-end with no client-supplied
  timestamp anywhere in the call.

## Downstream changes required by the ABI change

Removing `now_ts` from every write changed the contract's public ABI, so
every caller had to be updated in the same pass:

- **Frontend** — [Create.tsx](frontend/src/pages/Create.tsx),
  [MarketDetail.tsx](frontend/src/pages/MarketDetail.tsx),
  [Portfolio.tsx](frontend/src/pages/Portfolio.tsx): dropped the `nowTs()`
  argument from every `contractWrite(...)` call; removed the now-dead
  `nowTs()` helper from [wallet.tsx](frontend/src/lib/wallet.tsx).
- **Backend** — [resolver.js](backend/src/resolver.js): dropped the `now`
  argument from the auto-resolver's `request_resolution` call.

`tsc --noEmit` clean on the frontend after the change.

## Files touched

- `contracts/event_weaver.py`
- `tests/direct/test_event_weaver.py`
- `frontend/src/lib/wallet.tsx`
- `frontend/src/pages/Create.tsx`
- `frontend/src/pages/MarketDetail.tsx`
- `frontend/src/pages/Portfolio.tsx`
- `backend/src/resolver.js`
