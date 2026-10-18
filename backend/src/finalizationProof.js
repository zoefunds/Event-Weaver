/** Validate a user-submitted GenVM receipt before retaining it as the proof
 * that allows the settlement relay to request an authority signature. The
 * authority independently repeats these checks; this prevents the durable
 * relay ledger from being polluted with an unrelated transaction meanwhile. */
export const TERMINAL_METHODS = new Set(['request_resolution', 'expire_market', 'cancel_market']);
const TERMINAL_STATUSES = new Set(['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED']);

function receiptTerminalStatus(tx) {
  for (const receipt of tx?.consensus_data?.leader_receipt ?? []) {
    const readable = receipt?.result?.payload?.readable ?? '';
    const match = readable.match(/"status"\s*:\s*"(RESOLVED_YES|RESOLVED_NO|EXPIRED|CANCELLED)"/);
    if (match) return match[1];
  }
  return null;
}

export function assertFinalizedMarketProof(tx, contractAddress, marketId, terminalStatus) {
  const leaderSucceeded = tx?.consensus_data?.leader_receipt?.some((receipt) =>
    receipt?.execution_result === 'SUCCESS' && receipt?.result?.status === 'return'
  );
  const legacySucceeded = tx?.statusName === 'ACCEPTED'
    && tx?.txExecutionResultName === 'SUCCESS'
    && tx?.consensus_data?.final === true;
  const finalizedSucceeded = tx?.statusName === 'FINALIZED'
    && tx?.result_name === 'MAJORITY_AGREE' && leaderSucceeded;
  if (!legacySucceeded && !finalizedSucceeded) throw new Error('transaction is not finalized and successful');
  if (String(tx.to_address ?? tx.recipient ?? '').toLowerCase() !== contractAddress.toLowerCase()) {
    throw new Error('transaction targets a different GenLayer contract');
  }
  const decoded = tx.txDataDecoded ?? {};
  const readable = tx.data?.calldata?.readable ?? '';
  const method = decoded.functionName ?? decoded.function_name ?? decoded.method
    ?? readable.match(/"method"\s*:\s*"([^"]+)"/)?.[1];
  if (!TERMINAL_METHODS.has(method)) throw new Error('transaction is not a resolution or cancellation method');
  const args = decoded.args ?? decoded.arguments;
  const txMarketId = args ? Number(args[0]) : Number(readable.match(/"args"\s*:\s*\[\s*(-?\d+)/)?.[1]);
  if (txMarketId !== Number(marketId)) throw new Error('transaction market mismatch');
  if (!TERMINAL_STATUSES.has(terminalStatus)) throw new Error('market is not terminal');
  if (method === 'request_resolution') {
    if (receiptTerminalStatus(tx) !== terminalStatus) {
      throw new Error('resolution receipt does not prove this terminal market status');
    }
  } else if ((method === 'cancel_market' && terminalStatus !== 'CANCELLED')
      || (method === 'expire_market' && terminalStatus !== 'EXPIRED')) {
    throw new Error('terminal market status does not match the submitted transaction');
  }
  return method;
}
