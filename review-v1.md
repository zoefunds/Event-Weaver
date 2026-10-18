# Confirmed-Payment Review Archive

This historical review filename is retained for inbound links. Obsolete code excerpts,
addresses, test counts and deployment commands have been removed.

The current implementation records only confirmed Base Sepolia `Staked` logs, identifies each
deposit as `txHash:logIndex`, persists it in PostgreSQL, and retries the relayer-only GenLayer
`record_stake` call idempotently. Deposits applied after settlement receive independently
authorized Base refunds.

See [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md) for the canonical source commits,
deployment pair, adversarial tests and live transaction evidence.
