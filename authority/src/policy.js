import { getAddress } from 'ethers';

export const TERMINAL = new Set(['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED']);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/** Compare the signed request fields to the canonical Base `Staked` event.
 * This deliberately includes side: a valid deposit identifier and amount are
 * insufficient if a relay attempts to register it on the opposite book. */
export function assertCanonicalDeposit({ body, event, escrow }) {
  const expectedId = `${String(body.baseTxHash).toLowerCase()}:${Number(body.logIndex)}`;
  if (body.depositId !== expectedId) throw new Error('deposit id does not match transaction and log index');
  if (!event || getAddress(event.escrow) !== getAddress(escrow)) throw new Error('deposit log not emitted by canonical escrow');
  if (Number(event.marketId) !== Number(body.marketId)
      || getAddress(event.staker) !== getAddress(body.recipient)
      || Number(event.side) !== Number(body.side)
      || BigInt(event.amount) !== BigInt(body.amount)) {
    throw new Error('deposit payload does not match canonical Staked log');
  }
}

export function assertFinalizedSuccessfulTransaction(tx, expectedContract, allowedFunctions, marketId) {
  if (!tx || tx.statusName !== 'ACCEPTED' || tx.txExecutionResultName !== 'SUCCESS' || tx.consensus_data?.final !== true) {
    throw new Error('verdict transaction is not finalized and successful');
  }
  const target = tx.to_address ?? tx.recipient;
  if (!target || getAddress(String(target)) !== getAddress(expectedContract)) throw new Error('wrong GenLayer contract identity');
  const decoded = tx.txDataDecoded ?? {};
  const functionName = decoded.functionName ?? decoded.function_name ?? decoded.method;
  if (!allowedFunctions.includes(functionName)) throw new Error('transaction is not an authorized resolution method');
  const args = decoded.args ?? decoded.arguments ?? [];
  if (Number(args[0]) !== Number(marketId)) throw new Error('verdict transaction market mismatch');
}

export function assertCanonicalSettlement({ marketId, market, report, payouts, pool }) {
  if (Number(market.id) !== Number(marketId) || Number(report.market_id) !== Number(marketId)) throw new Error('market identity mismatch');
  if (!TERMINAL.has(market.status) || report.status !== market.status || Number(report.resolved_ts) <= 0) {
    throw new Error('market does not have a finalized terminal verdict');
  }
  if (Boolean(pool.settled)) throw new Error('market already settled');
  if (BigInt(pool.pending) !== 0n) throw new Error('unresolved deposit liabilities remain');
  if (!Array.isArray(payouts) || payouts.length === 0) throw new Error('terminal market has no canonical payouts');
  const seen = new Set();
  let total = 0n;
  for (const row of payouts) {
    const address = getAddress(row.address);
    if (seen.has(address)) throw new Error('duplicate payout recipient');
    seen.add(address);
    const amount = BigInt(row.amount);
    if (amount <= 0n) throw new Error('invalid payout amount');
    total += amount;
  }
  if (total + BigInt(pool.allocated) > BigInt(pool.deposited)) throw new Error('payout exceeds protected reserve');

  if (market.status === 'RESOLVED_YES') {
    let previous = 0;
    for (const step of report.steps) {
      const occurredAt = Number(step.occurred_at_ts);
      if (step.state !== 'FULFILLED' || occurredAt <= previous || occurredAt > Number(market.deadline_ts)) {
        throw new Error('YES verdict has invalid chronology');
      }
      previous = occurredAt;
    }
  }
  return { total };
}
