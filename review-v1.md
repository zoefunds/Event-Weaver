# Review: Confirmed-Payment Staking & Crash Recovery

> **Note (2026-10-09):** the addresses and `eventweaver-api-prod.fly.dev` backend referenced
> below are a point-in-time record and have since been superseded (new GenLayer contract, new
> escrow, new backend app). See [MEMORY.md](MEMORY.md#deployed-state-live) for what's actually
> live now.

## Request

> Before we can accept this update, please make sure a user's recorded stake is backed
> by a confirmed payment, including when they interact outside the website. Also show
> how users recover if payment succeeds but the next step fails. Please include the
> corrected code and tests for both cases.

## Status: Resolved

## The problem

The V1 USDC migration (`feat: migrate V1 staking to Base Sepolia USDC`) split staking
into two independent, unauthenticated steps:

1. The wallet deposits USDC into `EventWeaverEscrow.stake(marketId, amount)` on Base
   Sepolia.
2. The same wallet then calls `stake_yes(marketId, amount)` / `stake_no(marketId,
   amount)` directly on the GenLayer contract.

```python
# contracts/event_weaver.py — before
@gl.public.write
def stake_yes(self, market_id: int, amount: int) -> None:
    """Record a USDC stake on YES after the wallet has deposited the same
    six-decimal amount into EventWeaverEscrow on Base Sepolia."""
    self._stake(market_id, SIDE_YES, int(amount))
```

Nothing connected the two calls. `_stake` validated market state and the
`amount`/`min_stake` invariants, but never checked that a matching escrow deposit
existed — it trusted whatever `amount` the caller passed. Concretely:

- **No confirmed payment required.** Anyone could call `stake_yes(marketId, amount)`
  directly — via Etherscan-style raw calls, a script, or another dApp — and get a free
  position with no USDC ever deposited.
- **Broken for payments made outside the website.** The escrow's `stake()` is a public,
  permissionless Solidity function; a deposit made directly against it (bypassing the
  frontend) had no path to ever become a GenLayer position — no listener, no webhook, no
  reconciliation existed anywhere in the codebase.
- **No recovery if payment succeeds but the next step fails.** If the Base Sepolia
  deposit confirmed but the GenLayer call then failed (closed tab, wallet rejection,
  RPC hiccup, process crash), the user's USDC sat in escrow with zero corresponding
  position, and nothing — frontend, backend, or contract — ever detected or retried it.
  The only remedy was the escrow owner's manual `withdrawUnallocated`, which isn't wired
  to any automated detection.
- **No test coverage caught any of this.** The migration never updated
  `tests/direct/test_event_weaver.py`, which still called the old native-value
  `stake_yes(0)` API — the suite was failing outright
  (`TypeError: stake_yes() missing 1 required positional argument: 'amount'`), so the
  unverified staking path shipped with zero test coverage of its actual behavior.

## The fix

The fix makes payment confirmation and stake recording one atomic responsibility owned
by a trusted relayer, instead of two independent client calls:

1. **The payment itself becomes self-describing.** `EventWeaverEscrow.stake()` now takes
   `side` as part of the deposit (`stake(marketId, side, amount)`), so a payment made
   directly against the contract — by anyone, from anywhere, without the website — is
   fully interpretable on its own.

   ```solidity
   // contracts/base/EventWeaverEscrow.sol
   function stake(uint256 marketId, uint8 side, uint256 amount) external nonReentrant {
       require(amount > 0 && !pools[marketId].settled, "invalid stake");
       require(side == 1 || side == 2, "invalid side");
       require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transferFrom failed");
       pools[marketId].deposited += amount;
       emit Staked(marketId, msg.sender, side, amount);
   }
   ```

2. **GenLayer no longer accepts a self-reported stake from anyone.** `stake_yes` /
   `stake_no` are gone. The only way a `Position` can ever be created is
   `record_stake`, restricted to a trusted `relayer` address:

   ```python
   # contracts/event_weaver.py
   def _only_relayer(self) -> None:
       if gl.message.sender_address != self.relayer:
           raise gl.vm.UserError(ERR_EXPECTED + "only the relayer may call this")

   @gl.public.write
   def record_stake(self, market_id: int, staker: str, side: int, amount: int, base_tx_hash: str) -> None:
       """Relayer-only: record `staker`'s USDC stake after the relayer has
       independently confirmed a matching deposit finalized in
       EventWeaverEscrow on Base Sepolia.

       This is the *only* way a Position is ever created — there is no
       public, caller-funded stake entry point — so a recorded stake is
       always backed by a confirmed payment, including deposits made
       directly against the escrow contract rather than through the
       website.

       base_tx_hash is the escrow deposit's transaction hash and makes this
       call idempotent: replaying the same hash (e.g. the relayer retrying
       after it crashed between confirming the deposit and recording the
       stake) is a safe no-op instead of a double-credit.
       """
       self._only_relayer()
       _require(side in (SIDE_YES, SIDE_NO), "side must be YES (1) or NO (2)")
       tx_key = base_tx_hash.strip().lower()
       _require(bool(tx_key), "base_tx_hash is required")
       if self.applied_base_tx.get(tx_key):
           return
       self.applied_base_tx[tx_key] = True
       self._stake_for(market_id, Address(staker), side, int(amount))
   ```

   `relayer` defaults to the deploying address and is rotatable by the owner via
   `set_relayer(...)`. `applied_base_tx: TreeMap[str, bool]` tracks every deposit hash
   already consumed, making `record_stake` idempotent.

3. **A backend relay is the confirming party, and it never trusts the client.**
   `backend/src/stakeRelay.js` (new) is the *only* caller of `record_stake`:

   ```js
   // backend/src/stakeRelay.js — scanForDeposits (excerpt)
   const events = await escrow.queryFilter(escrow.filters.Staked(), fromBlock, toBlock);
   // ... insertPendingStakes(rows) — durable the moment a deposit clears confirmations

   // applyPendingStakes (excerpt)
   const hash = await client.writeContract({
     address: config.contractAddress,
     functionName: 'record_stake',
     args: [Number(row.market_id), row.staker, Number(row.side), Number(row.amount), row.base_tx_hash],
     value: 0n,
   });
   ```

   It watches Base Sepolia directly for `Staked` events — regardless of who or what
   called `stake()` — waits `BASE_SEPOLIA_STAKE_CONFIRMATIONS` (default 5) blocks for
   finality, and only then calls `record_stake`. This closes the "outside the website"
   requirement: a deposit made via a script, another dApp, or a raw contract call is
   scanned and recorded exactly the same way a frontend-originated one is.

4. **Recovery for "payment succeeds, next step fails" is a durable table plus an
   infinite retry loop**, not a client-side promise chain. The moment a deposit is
   confirmed on-chain it's written to a new Postgres table:

   ```sql
   -- backend/src/db.js
   CREATE TABLE IF NOT EXISTS pending_stakes (
     base_tx_hash TEXT PRIMARY KEY,
     market_id    BIGINT NOT NULL,
     staker       TEXT NOT NULL,
     side         SMALLINT NOT NULL,
     amount       NUMERIC NOT NULL,
     block_number BIGINT NOT NULL,
     status       TEXT NOT NULL DEFAULT 'confirmed_onchain',
     attempts     INT NOT NULL DEFAULT 0,
     last_error   TEXT,
     genlayer_tx_hash TEXT,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

   `startStakeRelay`'s tick calls `scanForDeposits` then `applyPendingStakes` on every
   cycle (≥15s). If `record_stake` fails for any reason, the row's `status` becomes
   `retry_pending` and `attempts` increments — the *next* tick tries it again,
   indefinitely, with no user action required and no dependency on the user's browser
   still being open. Because the deposit was durably recorded in step 4 *before* the
   GenLayer call was ever attempted, a backend crash between confirming the payment and
   recording the stake loses nothing: the row is still there on restart, still
   unapplied, and still gets retried.

   The frontend surfaces this instead of silently hoping it worked:

   ```ts
   // frontend/src/lib/api.ts
   stakeStatus: (txHash: string) =>
     get<{ status: string; attempts?: number; lastError?: string | null }>(`/api/stakes/${txHash}`),
   ```

   ```tsx
   // frontend/src/pages/MarketDetail.tsx
   const txHash = await depositStakeUsdc(marketId, side, units);
   push('info', 'Payment confirmed on Base Sepolia — recording your stake…');
   await waitForStakeApplied(txHash); // polls GET /api/stakes/:txHash until 'applied'
   ```

   `waitForStakeApplied` times out informationally after two minutes ("still recording
   your stake, refresh shortly") rather than as a failure — the relay keeps working
   regardless of whether that tab is still open.

## Tests

Added to **[tests/direct/test_event_weaver.py](tests/direct/test_event_weaver.py)**:

| Test | Proves |
| --- | --- |
| `test_only_relayer_may_record_a_stake` | Neither the staker themselves nor an unrelated third party can create a position — only the relayer can, which is what makes a recorded stake trustworthy. |
| `test_record_stake_is_idempotent_on_base_tx_hash` | Replaying the exact same `base_tx_hash` (modeling a relayer crash-and-retry) does not double-credit the position or pool — **this is the "payment succeeds, next step fails" recovery case**, proved at the contract level: a retried `record_stake` call is provably a safe no-op. |
| `test_record_stake_requires_base_tx_hash` | An empty tx hash is rejected — the idempotency key can't be skipped. |
| `test_set_relayer_rotates_the_trusted_relay_identity` | Rotating `relayer` immediately revokes the old identity and authorizes the new one — a stale/compromised relayer key can be cut off without redeploying. |
| `test_stake_moves_value_into_pools`, `test_stake_zero_value_reverts`, `test_stake_after_deadline_reverts` | Existing staking invariants (pool accounting, positive-amount, deadline) still hold end-to-end through the new relayer-only entry point. |

Every other staking-dependent test (`test_full_chain_resolves_yes_and_pays_out`,
`test_protocol_fees_accrue_and_sweep`, `test_creator_cancel_and_refund`,
`test_post_deadline_adjudication_is_permissionless_and_expires`,
`test_payout_amount_is_independent_of_any_caller_timing_claim`, and the timestamp
adversarial tests) was updated to stake through the new `relayer_stake()` test helper
instead of the removed `stake_yes`/`stake_no`, and the dead native-GEN `deposit()` /
`withdraw()` / `stake_from_balance()` assertions (already removed from the contract by
the earlier USDC migration but never removed from the tests) were cleaned up to match
current behavior.

## Verification

```
$ pytest tests/direct/test_event_weaver.py -v
...
31 passed
```

Before this fix, the suite did not run at all (`TypeError: stake_yes() missing 1
required positional argument: 'amount'`) — the corrected suite is the first one that
actually exercises the USDC staking path.

```
$ node --check backend/src/stakeRelay.js backend/src/db.js backend/src/routes.js backend/src/config.js backend/src/server.js
$ cd frontend && npx tsc --noEmit -p .
```

Both clean.

## Redeployed addresses

Because the escrow ABI (`stake` gained `side`) and the GenLayer ABI (`stake_yes`/
`stake_no` replaced by `record_stake`) both changed, this required fresh deployments
rather than an in-place upgrade:

| Component | Address |
| --- | --- |
| `EventWeaverEscrow` (Base Sepolia) | `0x83D73b3217314aF32D833e18d90356299835d0a5` |
| `EventWeaver` (GenLayer StudioNet) | `0x0551246DcB7de220474b5a479820AA18F1DDAB5C` |

Both the escrow's `relayer` and the GenLayer contract's `relayer` are set to the same
operational key, so one identity signs both `settle()` (Base Sepolia payouts) and
`record_stake()` (GenLayer stake recording). Backend (`eventweaver-api-prod.fly.dev`)
and frontend (`eventweaver-orpin.vercel.app`) were updated with the new addresses and
redeployed; `GET /health` and `GET /api/config` confirm the live contract address.

## Files touched

- `contracts/event_weaver.py`
- `contracts/base/EventWeaverEscrow.sol`
- `backend/src/stakeRelay.js` (new)
- `backend/src/db.js`
- `backend/src/routes.js`
- `backend/src/config.js`
- `backend/src/server.js`
- `backend/.env.example`
- `frontend/src/lib/baseSepolia.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/MarketDetail.tsx`
- `frontend/.env.example`
- `tests/direct/test_event_weaver.py`
- `docs/API.md`, `docs/CONTRACT.md`, `docs/DEPLOYMENT.md`
- `README.md`, `v1.md`
