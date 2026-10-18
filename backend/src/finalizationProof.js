/** Validate a user-submitted GenVM receipt before retaining it as the proof
 * that allows the settlement relay to request an authority signature. The
 * authority independently repeats these checks; this prevents the durable
 * relay ledger from being polluted with an unrelated transaction meanwhile. */
export const TERMINAL_METHODS = new Set(['request_resolution', 'check_step', 'expire_market', 'cancel_market']);

export function assertFinalizedMarketProof(tx, contractAddress, marketId) {
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
  return method;
}
