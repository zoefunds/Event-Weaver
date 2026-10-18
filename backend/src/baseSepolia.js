/** Base Sepolia relay. All financial payloads and signatures come from the
 * separately deployed authority service; this process never sees its key. */
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { config } from './config.js';
import { plain, readContract } from './genlayer.js';
import {
  authorizeDepositAcknowledgement,
  authorizeDepositRefund,
  authorizeMarketRegistration,
  authorizeSettlement,
} from './authorityClient.js';

const ABI = [
  'function genLayerContract() view returns (address)',
  'function registeredMarketHash(uint256 marketId) view returns (bytes32)',
  'function registerMarket(uint256 marketId, bytes32 marketHash, bytes authoritySignature)',
  'function acknowledgeDeposit(uint256 marketId, bytes32 depositId, address recipient, uint256 amount, bytes32 applicationHash, bytes authoritySignature)',
  'function allocateDepositRefund(uint256 marketId, bytes32 depositId, address recipient, uint256 amount, bytes32 reasonHash, bytes authoritySignature)',
  'function handledDeposit(bytes32 depositId) view returns (bool)',
  'function settle(uint256 marketId, bytes32 settlementId, address[] recipients, uint256[] amounts, bytes32 verdictHash, bytes authoritySignature)',
  'function pools(uint256 marketId) view returns (uint256 deposited, uint256 allocated, uint256 pending, bool settled)',
  'function claimable(uint256 marketId, address recipient) view returns (uint256)',
];
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const TERMINAL = new Set(['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED']);

export const baseRelayState = {
  configured: false,
  lastRunAt: null,
  registered: 0,
  settled: 0,
  lastError: null,
};

function contract() {
  if (!config.baseSepolia.relayerPrivateKey) throw new Error('BASE_SEPOLIA_RELAYER_PRIVATE_KEY is not configured');
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  return new Contract(config.baseSepolia.escrowAddress, ABI, new Wallet(config.baseSepolia.relayerPrivateKey, provider));
}

export async function getBaseClaimable(marketId, recipient) {
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  const escrow = new Contract(config.baseSepolia.escrowAddress, ABI, provider);
  return (await escrow.claimable(marketId, recipient)).toString();
}

export function isBaseRelayConfigured() {
  return Boolean(config.baseSepolia.relayerPrivateKey && config.settlementSigner.url && config.settlementSigner.token);
}

export async function isBaseMarketSettled(marketId) {
  return Boolean((await contract().pools(marketId)).settled);
}

export async function ensureMarketRegistered(marketId, logger) {
  const escrow = contract();
  if ((await escrow.registeredMarketHash(marketId)) !== ZERO_HASH) return false;
  const authorization = await authorizeMarketRegistration(marketId);
  if (Number(authorization.marketId) !== Number(marketId)) throw new Error('signer returned wrong market id');
  const tx = await escrow.registerMarket(marketId, authorization.marketHash, authorization.signature);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`market registration failed for ${marketId}`);
  logger.info({ marketId, txHash: tx.hash }, 'registered canonical GenLayer market on Base');
  return true;
}

export async function acknowledgeBaseDeposit(row, logger) {
  const escrow = contract();
  const depositHash = keccak256(toUtf8Bytes(row.deposit_id));
  if (await escrow.handledDeposit(depositHash)) return true;
  try {
    const authorization = await authorizeDepositAcknowledgement(row);
    const tx = await escrow.acknowledgeDeposit(
      Number(row.market_id), depositHash, row.staker, BigInt(row.amount),
      authorization.applicationHash, authorization.signature
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`deposit acknowledgement failed for ${row.deposit_id}`);
    logger.info({ depositId: row.deposit_id, txHash: tx.hash }, 'acknowledged GenLayer-applied Base deposit');
  } catch (error) {
    // Multiple relay instances can observe the same pending row. If another
    // instance handled it between our first read and signing/submission, the
    // desired on-chain state is already reached and this retry is successful.
    if (await escrow.handledDeposit(depositHash)) {
      logger.info({ depositId: row.deposit_id }, 'Base deposit was already handled by another relay');
      return true;
    }
    throw error;
  }
  return true;
}

export async function relayDepositRefund(row, reason, logger) {
  const escrow = contract();
  const depositHash = keccak256(toUtf8Bytes(row.deposit_id));
  if (await escrow.handledDeposit(depositHash)) return true;
  try {
    const authorization = await authorizeDepositRefund(row, reason);
    const tx = await escrow.allocateDepositRefund(
      Number(row.market_id), depositHash, row.staker, BigInt(row.amount),
      authorization.reasonHash, authorization.signature
    );
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`deposit refund allocation failed for ${row.deposit_id}`);
    logger.info({ depositId: row.deposit_id, txHash: tx.hash, reason }, 'deposit refund allocated on Base');
  } catch (error) {
    if (await escrow.handledDeposit(depositHash)) {
      logger.info({ depositId: row.deposit_id }, 'Base deposit refund was already handled by another relay');
      return true;
    }
    throw error;
  }
  return true;
}

export async function relayMarket(marketId, logger) {
  const market = plain(await readContract('get_market', [marketId]));
  if (!TERMINAL.has(market.status)) return false;
  const escrow = contract();
  const pool = await escrow.pools(marketId);
  if (pool.settled) return false;
  if (pool.pending > 0n) throw new Error(`market ${marketId}: ${pool.pending} deposit units remain unresolved`);

  // The independent service reads canonical GenLayer/Base state itself and
  // returns the exact payload it authorized. The relayer does not construct
  // or mutate recipients, amounts, verdicts, or settlement identity.
  const authorization = await authorizeSettlement(marketId);
  if (Number(authorization.marketId) !== Number(marketId)) throw new Error('signer returned wrong market id');
  const recipients = authorization.recipients;
  const amounts = authorization.amounts.map(BigInt);
  const tx = await escrow.settle(
    marketId, authorization.settlementId, recipients, amounts,
    authorization.verdictHash, authorization.signature
  );
  logger.info({ marketId, txHash: tx.hash, recipientCount: recipients.length }, 'relaying independently authorized USDC payouts');
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Base settlement failed for market ${marketId}`);
  return true;
}

export function startBaseRelay(logger) {
  baseRelayState.configured = isBaseRelayConfigured();
  if (!isBaseRelayConfigured()) {
    logger.warn('Base Sepolia relay disabled: relayer or independent signer configuration is missing');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      baseRelayState.lastRunAt = new Date().toISOString();
      baseRelayState.lastError = null;
      const count = Number(await readContract('get_market_count'));
      for (let id = 0; id < count; id++) {
        try { if (await ensureMarketRegistered(id, logger)) baseRelayState.registered += 1; }
        catch (err) { logger.error({ err, marketId: id }, 'market registration relay failed; will retry'); }
      }
      const groups = await Promise.all(
        [...TERMINAL].map((status) => readContract('get_market_ids_by_status', [status]).then(plain))
      );
      for (const id of groups.flat()) {
        try { if (await relayMarket(Number(id), logger)) baseRelayState.settled += 1; }
        catch (err) { logger.error({ err, marketId: id }, 'USDC relay failed; will retry'); }
      }
    } catch (err) {
      baseRelayState.lastError = err.message;
      logger.error({ err }, 'Base USDC relay scan failed');
    }
    finally { running = false; }
  };
  tick();
  setInterval(tick, Math.max(config.pollIntervalMs, 30000)).unref();
}
