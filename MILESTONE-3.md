# Milestone 3 Archive

This filename is retained so historical links remain valid. Its former deployment addresses,
test totals and rollout instructions are superseded and have been removed to prevent accidental
reuse.

Current implementation, deployment pair, finalized receipts, Base transactions, wallet-balance
proof and test results are recorded in [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md).

The active system uses:

- GenLayer StudioNet: `0x3b1781e005AEEf7ec64A51a8DFA323A16aAa0a6f`
- Base Sepolia escrow: `0xd1c6864eCE3f06B1a18932905ab816635726040c`
- Backend: https://eventweaver-api-v2.fly.dev
- Frontend: https://eventweaver-orpin.vercel.app

The milestone’s late-arriving-deposit objective remains implemented, but the current design
adds authenticated post-settlement Base refunds, `txHash:logIndex` identity, authority-bound
settlement, protected custody, immutable fee snapshots and verified event chronology.
