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

/** A deposit applied after a staking window closes is intentionally recorded
 * as `late_amount`, not as a YES/NO position. It still must be acknowledged
 * on Base so the pending principal reserve is released into a later
 * cancellation/refund allocation. */
export function assertCanonicalAppliedDeposit({ position, appliedLate, side, amount }) {
  const principal = BigInt(amount);
  if (principal <= 0n) throw new Error('invalid applied deposit amount');
  const credited = appliedLate
    ? BigInt(position?.late_amount ?? 0)
    : BigInt(Number(side) === 1 ? (position?.yes_amount ?? 0) : (position?.no_amount ?? 0));
  if (credited < principal) {
    throw new Error(appliedLate
      ? 'canonical GenLayer position does not contain the late-refund amount'
      : 'canonical GenLayer position does not contain the deposited side and amount');
  }
}

function receiptTerminalStatus(tx) {
  for (const receipt of tx?.consensus_data?.leader_receipt ?? []) {
    const readable = receipt?.result?.payload?.readable ?? '';
    const match = readable.match(/"status"\s*:\s*"(RESOLVED_YES|RESOLVED_NO|EXPIRED|CANCELLED)"/);
    if (match) return match[1];
  }
  return null;
}

export function assertFinalizedSuccessfulTransaction(tx, expectedContract, allowedFunctions, marketId, terminalStatus) {
  // StudioNet has used two receipt shapes. Older receipts report ACCEPTED
  // with an explicit consensus final flag; current receipts report FINALIZED
  // with an agreed result and a successful leader execution receipt. Accept
  // either complete representation, never a merely pending/accepted result.
  const legacyFinalSuccess = tx?.statusName === 'ACCEPTED'
    && tx?.txExecutionResultName === 'SUCCESS'
    && tx?.consensus_data?.final === true;
  const finalizedReceipt = tx?.statusName === 'FINALIZED'
    && tx?.result_name === 'MAJORITY_AGREE'
    && tx?.consensus_data?.leader_receipt?.some((receipt) =>
      receipt?.execution_result === 'SUCCESS' && receipt?.result?.status === 'return'
    );
  if (!legacyFinalSuccess && !finalizedReceipt) {
    throw new Error('verdict transaction is not finalized and successful');
  }
  const target = tx.to_address ?? tx.recipient;
  if (!target || getAddress(String(target)) !== getAddress(expectedContract)) throw new Error('wrong GenLayer contract identity');
  const decoded = tx.txDataDecoded ?? {};
  // Current StudioNet responses expose human-readable calldata rather than
  // txDataDecoded. Parse only the method name and market id needed to bind
  // this receipt; canonical on-chain reads bind every financial field.
  const readable = tx.data?.calldata?.readable ?? '';
  const functionName = decoded.functionName ?? decoded.function_name ?? decoded.method
    ?? readable.match(/"method"\s*:\s*"([^"]+)"/)?.[1];
  if (!allowedFunctions.includes(functionName)) throw new Error('transaction is not an authorized resolution method');
  const args = decoded.args ?? decoded.arguments;
  const receiptMarketId = args ? Number(args[0]) : Number(readable.match(/"args"\s*:\s*\[\s*(-?\d+)/)?.[1]);
  if (receiptMarketId !== Number(marketId)) throw new Error('verdict transaction market mismatch');
  if (!TERMINAL.has(terminalStatus)) throw new Error('market is not terminal');
  if (functionName === 'request_resolution') {
    if (receiptTerminalStatus(tx) !== terminalStatus) {
      throw new Error('resolution receipt does not prove this terminal market status');
    }
  } else if ((functionName === 'cancel_market' && terminalStatus !== 'CANCELLED')
      || (functionName === 'expire_market' && terminalStatus !== 'EXPIRED')) {
    throw new Error('terminal market status does not match the submitted transaction');
  } else if (functionName === 'check_step') {
    throw new Error('single-step receipts cannot prove a terminal market transition');
  }
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
