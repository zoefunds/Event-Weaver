import { config } from './config.js';

async function request(path, body) {
  if (!config.settlementSigner.url || !config.settlementSigner.token) {
    throw new Error('independent settlement signer is not configured');
  }
  const response = await fetch(`${config.settlementSigner.url}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.settlementSigner.token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`settlement signer rejected request: ${payload.error ?? response.status}`);
  return payload;
}

export const authorizeMarketRegistration = (marketId) => request('/v1/register-market', { marketId });
export const authorizeDepositAcknowledgement = (row) => request('/v1/acknowledge-deposit', {
  depositId: row.deposit_id,
  baseTxHash: row.base_tx_hash,
  logIndex: Number(row.log_index),
  marketId: Number(row.market_id),
  recipient: row.staker,
  amount: String(row.amount),
});
export const authorizeDepositRefund = (row, reason) => request('/v1/refund-deposit', {
  depositId: row.deposit_id,
  baseTxHash: row.base_tx_hash,
  logIndex: Number(row.log_index),
  marketId: Number(row.market_id),
  recipient: row.staker,
  amount: String(row.amount),
  reason,
});
export const authorizeSettlement = (marketId) => request('/v1/settlement', { marketId });
