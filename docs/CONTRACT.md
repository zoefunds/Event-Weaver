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

## Fees & settlement

Losing pool → 1% protocol fee (accrued, owner-sweepable) + 0.5% creator fee (credited) →
remainder distributed pro-rata to winning stakers on `claim`. Creation bond returned on any
clean terminal resolution. Cancelled markets refund everyone in full.

## Verified on StudioNet (integration evidence)

- Deploy + `genlayer schema` loads (35 methods).
- `create_market` with 2–3 step chains (CLI and JS paths).
- Payable `stake_yes` moved native value into the pool (activity log + pool balances).
- `deposit` credited internal balance; `withdraw` accepted (native transfer at finality).
- `request_resolution` fetched `apple.com/newsroom` live, LLM produced a correct
  low-confidence PENDING verdict (no price cut announced), consensus `MAJORITY_AGREE`
  in one round — no leader rotation, no Undetermined.
