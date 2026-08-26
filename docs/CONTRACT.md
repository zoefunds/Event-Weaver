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
   Never `strict_eq` for non-deterministic output.
6. **Verdict application**: FULFILLED is sticky; inconclusive verdicts keep steps PENDING;
   steps verify strictly in order; `can_still_occur=false` + confidence ≥ floor is the only
   path to FAILED before the deadline.
7. **Source size**: keep the file well under ~60KB; StudioNet rejects oversized deploy payloads.

## Error classes

`EXPECTED:` caller mistakes (bad input/state) · `EXTERNAL:` upstream web failures ·
`TRANSIENT:` retryable · `LLM_ERROR:` unusable model output after sanitation.

## V1 USDC settlement

The GenLayer contract is the outcome and allocation ledger, not a native-token custodian in V1. It records USDC-denominated positions in six-decimal units and exposes `get_base_payouts(market_id)` after a terminal result. The backend relayer copies that immutable allocation list into the Base Sepolia escrow at `0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C`. Each recipient then claims USDC directly from the escrow. The escrow's `claimable` view is the authoritative post-claim balance.

## Fees & settlement

Losing pool → 1% protocol fee + 0.5% creator fee → remainder distributed pro-rata to winning
stakers through the Base escrow allocation list. Cancelled markets receive the contract-defined
refund allocation. There is no V1 `withdraw` of native GEN.

## Verified on StudioNet (integration evidence)

- Deploy + `genlayer schema` loads (35 methods).
- `create_market` with 2–3 step chains (CLI and JS paths).
- `stake_yes(market_id, amount)` records a confirmed Base Sepolia USDC stake in the
  GenLayer consensus ledger (activity log + pool balances).
- Final payouts come from `get_base_payouts`; the Base escrow relayer settles them and
  winners self-claim USDC from Base Sepolia.
- `request_resolution` fetched `apple.com/newsroom` live, LLM produced a correct
  low-confidence PENDING verdict (no price cut announced), consensus `MAJORITY_AGREE`
  in one round — no leader rotation, no Undetermined.
