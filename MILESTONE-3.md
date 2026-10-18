# Milestone 3 Archive

This filename is retained so historical links remain valid. Its former deployment addresses,
test totals and rollout instructions are superseded and have been removed to prevent accidental
reuse.

Current implementation, deployment pair, finalized receipts, Base transactions, wallet-balance
proof and test results are recorded in [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md).

The active system uses:

- GenLayer StudioNet: `0xEce2907092e324D0C9DE5fbaBaE20aA65E12C641`
- Base Sepolia escrow: `0xeCb1A2D7A72aF31C0F2F48858A505C3aF8279f4b`
- Backend: https://eventweaver-api-v2.fly.dev
- Frontend: https://eventweaver-orpin.vercel.app

The milestone’s late-arriving-deposit objective remains implemented, but the current design
adds authenticated post-settlement Base refunds, `txHash:logIndex` identity, authority-bound
settlement, protected custody, immutable fee snapshots and verified event chronology.
