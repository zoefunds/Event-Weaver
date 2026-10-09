# Milestone 3: Late-arriving confirmed-deposit recovery, implemented and verified live

> **Note (2026-10-09):** this document is a point-in-time submission record. The contract and
> backend it describes as newly redeployed are accurate as of this writing, but the Base Sepolia
> escrow (`0x83D73b3217314aF32D833e18d90356299835d0a5`, implied by the unchanged relayer/escrow
> wiring below) was later replaced too, and the backend has since migrated off
> `eventweaver-api-prod.fly.dev`. See [MEMORY.md](MEMORY.md#deployed-state-live) for current
> addresses; do not use the ones below for anything but historical reference.

Prior rejection and what changed since:

1. A confirmed deposit could reach record_stake after the deadline and remain uncredited
backend/src/stakeRelay.js records every confirmed Base Sepolia Staked event and retries record_stake() forever until it succeeds. That assumed every failure was transient, but EventWeaverEscrow.stake() has no deadline check of its own — it only refuses a deposit once its market is settled. record_stake()'s underlying _stake_for() (contracts/event_weaver.py) required the market to still be OPEN/RESOLVING and before deadline_ts. So a deposit could confirm before the deadline while the relayer was delayed (crash, RPC rate limit, restart) into applying it after. That reverted, discarding the applied_base_tx write with it — so retries kept failing the same way forever, and the deposit sat in escrow, permanently uncredited, with no Position and no durable error. Fixed: record_stake now checks the staking window itself; if closed, it routes to a new _credit_late_stake path that refunds the deposit at face value via a new Position.late_amount field instead of reverting, and always durably marks applied_base_tx, so the retry loop stops. late_amount never enters yes_pool/no_pool, so it can't shift odds for stakers who staked while genuinely open. claim, refund_cancelled, get_position, quote_payout, and get_base_payouts all account for it, flowing through the existing settlement relay unchanged.

Code:
Fix commit: https://github.com/zoefunds/Event-Weaver/commit/a0b3e8f53ae3bf1576e164e060fd47b220062064
Contract: https://github.com/zoefunds/Event-Weaver/blob/main/contracts/event_weaver.py
Direct test suite (executes the real deployed contract source natively via gltest.direct; only web/LLM calls are mocked): https://github.com/zoefunds/Event-Weaver/blob/main/tests/direct/test_event_weaver.py
Full writeup: https://github.com/zoefunds/Event-Weaver/blob/main/review2-v1.md

Live production verification (real StudioNet transactions, not mocked, not simulated):
Contract (GenLayer StudioNet): 0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6 (https://explorer-studio.genlayer.com/address/0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6), redeployed with the fix, replacing 0x0551246DcB7de220474b5a479820AA18F1DDAB5C.
Real set_relayer call rotating the trusted relayer to match EventWeaverEscrow.relayer() on Base Sepolia, FINALIZED with 5 validators reaching Accepted consensus: https://explorer-studio.genlayer.com/tx/0x95c92b5c8dd714795f366780677346a37fab75f91ccb01c7a5125184ac65a6e6 — get_config confirms relayer: 0x7401c129EDfc26E68FE19309fE461eb3Db1058Eb, distinct from owner, matching the escrow.
Backend redeployed, confirmed live: curl https://eventweaver-api-prod.fly.dev/health → {"ok":true,"stakeRelay":{"configured":true},"contract":"0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6"}.
Frontend redeployed to production at https://eventweaver-orpin.vercel.app, pointed at the same contract.

A second, unrelated bug found while redeploying: the genlayer CLI's address auto-detection passed an already-constructed Address into set_relayer's str-typed parameter, raising TypeError: cannot convert 'Address' object to bytes. Fixed by accepting both forms in set_relayer/set_owner.

Deterministic proof the rejected scenario is now recovered (a live elapsed-time reproduction would require deliberately waiting out a real deadline with a real deposit — impractical for this submission — so the direct suite exercises the identical code path instead):
test_stake_after_deadline_is_refunded_not_pooled — a deposit relayed after the deadline no longer reverts, is credited to late_amount, never enters the YES pool.
test_late_refund_is_idempotent_and_claimable_after_expiry — deposit relayed late → market expires → get_base_payouts includes the refund → claim() pays it in full; replaying base_tx_hash does not double-credit it.
test_late_refund_after_market_already_resolved — a deposit relayed after cancellation is refunded the same way, via refund_cancelled().
Two pre-existing tests asserting the old broken revert behavior were corrected rather than deleted, so the regression is visible in the diff.

$ pytest tests/direct/test_event_weaver.py -q
33 passed, confirming no regression elsewhere (idempotency, access control, relayer rotation, staking, adjudication, expiry, cancellation, claim/refund).

Submitting main at commit a0b3e8f53ae3bf1576e164e060fd47b220062064 as a new milestone, which includes the fix, its test suite, and this live deployment/verification record.
