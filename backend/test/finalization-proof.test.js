import test from 'node:test';
import assert from 'node:assert/strict';
import { assertFinalizedMarketProof } from '../src/finalizationProof.js';

const contract = '0x1111111111111111111111111111111111111111';
const good = {
  statusName: 'FINALIZED', result_name: 'MAJORITY_AGREE', to_address: contract,
  data: { calldata: { readable: '{"args":[4,]"method":"cancel_market"}' } },
  consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS', result: { status: 'return' } }] },
};

test('only finalized canonical resolution or cancellation receipts are retained', () => {
  assert.equal(assertFinalizedMarketProof(good, contract, 4, 'CANCELLED'), 'cancel_market');
  assert.throws(() => assertFinalizedMarketProof({ ...good, result_name: 'NO_MAJORITY' }, contract, 4, 'CANCELLED'));
  assert.throws(() => assertFinalizedMarketProof({ ...good, to_address: '0x2222222222222222222222222222222222222222' }, contract, 4, 'CANCELLED'));
  assert.throws(() => assertFinalizedMarketProof({ ...good, data: { calldata: { readable: '{"args":[5,]"method":"cancel_market"}' } } }, contract, 4, 'CANCELLED'));
  assert.throws(() => assertFinalizedMarketProof({ ...good, data: { calldata: { readable: '{"args":[4,]"method":"claim"}' } } }, contract, 4, 'CANCELLED'));
  assert.throws(() => assertFinalizedMarketProof(good, contract, 4, 'RESOLVED_YES'));
});

test('resolution receipt must itself return the exact terminal status', () => {
  const resolution = {
    ...good,
    data: { calldata: { readable: '{"args":[4,]"method":"request_resolution"}' } },
    consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS', result: {
      status: 'return', payload: { readable: '{"id":4"status":"RESOLVED_YES"}' },
    } }] },
  };
  assert.equal(assertFinalizedMarketProof(resolution, contract, 4, 'RESOLVED_YES'), 'request_resolution');
  assert.throws(() => assertFinalizedMarketProof(resolution, contract, 4, 'RESOLVED_NO'));
  assert.throws(() => assertFinalizedMarketProof({ ...resolution, consensus_data: { leader_receipt: [{ execution_result: 'SUCCESS', result: { status: 'return' } }] } }, contract, 4, 'RESOLVED_YES'));
});
