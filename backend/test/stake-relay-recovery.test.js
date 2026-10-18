import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { scanForDeposits } from '../src/stakeRelay.js';
import { listStakesForAddress } from '../src/db.js';

test('missing cursor recovers deposits from escrow deployment block, not a recent window', async () => {
  const original = config.baseSepolia.escrowDeploymentBlock;
  config.baseSepolia.escrowDeploymentBlock = 100;
  const staker = '0x3333333333333333333333333333333333333333';
  const hash = `0x${'34'.repeat(32)}`;
  const ranges = [];
  const provider = { getBlockNumber: async () => 1_000 };
  const escrow = {
    filters: { Staked: () => ({}) },
    queryFilter: async (_filter, from, to) => {
      ranges.push([from, to]);
      return [{
        transactionHash: hash, index: 9, blockNumber: 150,
        args: { marketId: 4n, staker, side: 1n, amount: 25n },
      }];
    },
  };
  const logger = { info() {}, error() {}, warn() {} };
  try {
    await scanForDeposits(logger, { provider, escrow });
    assert.deepEqual(ranges, [[100, 290]]);
    const rows = await listStakesForAddress(staker);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deposit_id, `${hash}:9`);
    assert.equal(rows[0].block_number, 150);
  } finally {
    config.baseSepolia.escrowDeploymentBlock = original;
  }
});
