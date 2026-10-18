# Authenticated-Time Review Archive

This historical review filename is retained for inbound links. Obsolete test totals and
point-in-time implementation notes have been removed.

The active Intelligent Contract uses GenVM’s consensus-authenticated clock for deadlines and
requires an evidence-backed `occurred_at_ts` for every fulfilled step. Occurrence times must be
plausible, not future-dated, not after the market deadline, and strictly increasing across the
causal chain.

See [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md) for current tests and finalized live
adjudication evidence.
