import test from 'node:test';
import assert from 'node:assert/strict';
import { insertPendingStakes, listStakesForAddress } from '../src/db.js';

test('same transaction events are stored separately and event replays deduplicate', async () => {
  const hash = `0x${'ab'.repeat(32)}`;
  const staker = '0x1111111111111111111111111111111111111111';
  const base = { baseTxHash: hash, marketId: 7, staker, side: 1, blockNumber: 99 };
  await insertPendingStakes([
    { ...base, depositId: `${hash}:4`, logIndex: 4, amount: '10' },
    { ...base, depositId: `${hash}:5`, logIndex: 5, amount: '20' },
    { ...base, depositId: `${hash}:5`, logIndex: 5, amount: '20' },
  ]);
  const rows = await listStakesForAddress(staker);
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((row) => row.deposit_id)), new Set([`${hash}:4`, `${hash}:5`]));
});
