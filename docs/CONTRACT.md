# Intelligent Contract Reference — `contracts/event_weaver.py`

Runner: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6` (docs-pinned).

## Design invariants (do not break these)

1. **Header**: Depends comment is line 1, blank line at line 2. GenVM parses the entire
   leading comment block as runner JSON.
2. **Storage**: TreeMap keys are `u32`/`str`/`Address` (Comparable). Never instantiate
   `DynArray[...]()` — assign plain Python lists/values and let the SDK coerce.
3. **Schema-safety**: public method params/returns are only `str/int/bool/dict/list`.
4. **JSON params**: Studio/CLI may auto-decode JSON strings into lists — `create_market`
   accepts both.
5. **Equivalence**: all web/LLM work runs under `gl.eq_principle.prompt_comparative` with the
   tolerance principle (verdict booleans must match; confidence within 25 pts; prose ignored).
   When event timing can affect the outcome, the decision-critical UTC occurrence date and
   deadline side must also match.
   Never `strict_eq` for non-deterministic output.
6. **Verdict application**: FULFILLED is sticky; inconclusive verdicts keep steps PENDING;
   steps verify strictly in order; `can_still_occur=false` + confidence ≥ floor is the only
   path to FAILED before the deadline.
7. **Source size**: keep the file well under ~60KB; StudioNet rejects oversized deploy payloads.

## Error classes

`EXPECTED:` caller mistakes (bad input/state) · `EXTERNAL:` upstream web failures ·
`TRANSIENT:` retryable · `LLM_ERROR:` unusable model output after sanitation.

## V1 USDC settlement

The GenLayer contract is the outcome and allocation ledger, not a native-token custodian. It records USDC-denominated positions in six-decimal units and exposes `get_base_payouts(market_id)` after a terminal result. The backend submits that immutable allocation list to the Base Sepolia escrow at `0xd84ec8bf005f7159F91118Cae80868D1F1Fd3f18`; settlement additionally requires a separate authority signature bound to the finalized verdict and complete payout hash. Each recipient then claims USDC directly from the escrow. The escrow's `claimable` view is the authoritative post-claim balance.

## Fees & settlement

Each market snapshots the protocol and creator fee basis points at creation. The losing pool
uses that immutable snapshot; the remainder is distributed pro-rata to winning stakers through
the Base escrow allocation list. If the winning side has no participants, every participant
receives principal back and no fee accrues. Cancelled markets receive the contract-defined
refund allocation. There is no V1 `withdraw` of native GEN.

## Verified on StudioNet (integration evidence)

- Deploy + `genlayer schema` loads the complete public interface.
- `create_market` with 2–3 step chains (CLI and JS paths).
- `record_stake(market_id, staker, side, amount, deposit_id)` — relayer-only — records a
  confirmed Base Sepolia USDC stake in the GenLayer consensus ledger (activity log + pool
  balances) on behalf of `staker`, once the backend stake relay has observed the matching
  `Staked` event finalize on Base Sepolia. `deposit_id` is `txHash:logIndex`, so retries are
  safe while distinct logs from the same transaction remain distinct stakes.
- Final payouts come from `get_base_payouts`; the Base relayer can settle only with an
  independent authority signature over the canonical allocation and finalized verdict.
  Post-settlement late deposits receive separately authenticated, idempotent refunds.
- Every fulfilled step records an evidence-backed `occurred_at_ts`; the contract requires
  strictly increasing occurrence times across the causal chain.
- `request_resolution` fetched `apple.com/newsroom` live, LLM produced a correct
  low-confidence PENDING verdict (no price cut announced), consensus `MAJORITY_AGREE`
  in one round — no leader rotation, no Undetermined.
