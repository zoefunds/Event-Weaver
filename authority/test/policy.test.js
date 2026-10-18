import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCanonicalSettlement, assertFinalizedSuccessfulTransaction } from '../src/policy.js';

const contract = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const acceptedTx = {
  statusName: 'ACCEPTED', txExecutionResultName: 'SUCCESS', consensus_data: { final: true },
  to_address: contract, txDataDecoded: { functionName: 'request_resolution', args: [7] },
};

test('pending, unsuccessful, wrong-contract and wrong-market verdict transactions are rejected', () => {
  assert.doesNotThrow(() => assertFinalizedSuccessfulTransaction(acceptedTx, contract, ['request_resolution'], 7));
  for (const mutation of [
    { statusName: 'PENDING' }, { txExecutionResultName: 'ERROR' }, { consensus_data: { final: false } },
    { to_address: recipient }, { txDataDecoded: { functionName: 'request_resolution', args: [8] } },
  ]) assert.throws(() => assertFinalizedSuccessfulTransaction({ ...acceptedTx, ...mutation }, contract, ['request_resolution'], 7));
});

test('fabricated verdicts and altered payout instructions are rejected', () => {
  const input = {
    marketId: 7,
    market: { id: 7, status: 'RESOLVED_YES', deadline_ts: 200 },
    report: { market_id: 7, status: 'RESOLVED_YES', resolved_ts: 300, steps: [
      { state: 'FULFILLED', occurred_at_ts: 100 }, { state: 'FULFILLED', occurred_at_ts: 150 },
    ] },
    payouts: [{ address: recipient, amount: '100' }],
    pool: { deposited: 100n, allocated: 0n, pending: 0n, settled: false },
  };
  assert.doesNotThrow(() => assertCanonicalSettlement(input));
  assert.throws(() => assertCanonicalSettlement({ ...input, report: { ...input.report, status: 'RESOLVED_NO' } }));
  assert.throws(() => assertCanonicalSettlement({ ...input, payouts: [{ address: recipient, amount: '101' }] }));
  assert.throws(() => assertCanonicalSettlement({ ...input, pool: { ...input.pool, pending: 1n } }));
  assert.throws(() => assertCanonicalSettlement({ ...input, report: { ...input.report, steps: [
    { state: 'FULFILLED', occurred_at_ts: 160 }, { state: 'FULFILLED', occurred_at_ts: 150 },
  ] } }));
});
