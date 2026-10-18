# Late-Deposit Review Archive

This historical review filename is retained for inbound links. Superseded deployment details,
commands and transaction-hash-only examples have been removed.

The current cross-chain recovery path is:

1. Base `Staked` events are keyed by `txHash:logIndex`.
2. The relay durably applies each confirmed event to GenLayer.
3. GenLayer marks deposits arriving outside the staking window as late without adding them to
   either market pool.
4. If Base settlement already occurred, the independent authority signs a deposit-specific
   refund and the relayer calls the authority-signed `allocateDepositRefund` path.
5. Replays are harmless on both chains.

See [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md) for the current deployment and proof.
