/** Base Sepolia settlement relay. It reads the immutable GenLayer result and
 * credits claims in EventWeaverEscrow; it never holds a user's USDC. */
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config } from './config.js';
import { plain, readContract } from './genlayer.js';

const ABI = [
  'function settle(uint256 marketId, address[] recipients, uint256[] amounts)',
  'function pools(uint256 marketId) view returns (uint256 deposited, uint256 allocated, bool settled)',
  'function claimable(uint256 marketId, address recipient) view returns (uint256)',
];
const TERMINAL = new Set(['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED']);

function contract() {
  if (!config.baseSepolia.relayerPrivateKey) throw new Error('BASE_SEPOLIA_RELAYER_PRIVATE_KEY is not configured');
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  return new Contract(config.baseSepolia.escrowAddress, ABI, new Wallet(config.baseSepolia.relayerPrivateKey, provider));
}

/** Read the current payout from Base, which is authoritative after a user has
 * claimed. GenLayer retains the outcome quote but cannot observe an EVM claim. */
export async function getBaseClaimable(marketId, recipient) {
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  const escrow = new Contract(config.baseSepolia.escrowAddress, ABI, provider);
  return (await escrow.claimable(marketId, recipient)).toString();
}

export function isBaseRelayConfigured() { return Boolean(config.baseSepolia.relayerPrivateKey); }

export async function relayMarket(marketId, logger) {
  const market = plain(await readContract('get_market', [marketId]));
  if (!TERMINAL.has(market.status)) return false;
  const escrow = contract();
  const pool = await escrow.pools(marketId);
  if (pool.settled) return false;
  const payouts = plain(await readContract('get_base_payouts', [marketId]));
  if (!payouts.length) return false;
  const recipients = payouts.map((row) => row.address);
  const amounts = payouts.map((row) => BigInt(row.amount));
  const allocated = amounts.reduce((total, amount) => total + amount, 0n);
  if (allocated > pool.deposited) {
    throw new Error(`market ${marketId}: Base escrow has ${pool.deposited}, but GenLayer allocated ${allocated}`);
  }
  const tx = await escrow.settle(marketId, recipients, amounts);
  logger.info({ marketId, txHash: tx.hash, recipientCount: recipients.length }, 'relaying USDC payouts to Base Sepolia');
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Base settlement failed for market ${marketId}`);
  return true;
}

export function startBaseRelay(logger) {
  if (!isBaseRelayConfigured()) {
    logger.warn('Base Sepolia relayer disabled: BASE_SEPOLIA_RELAYER_PRIVATE_KEY is not set');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const ids = plain(await readContract('get_market_ids_by_status', ['RESOLVED_YES']));
      const noIds = plain(await readContract('get_market_ids_by_status', ['RESOLVED_NO']));
      const expiredIds = plain(await readContract('get_market_ids_by_status', ['EXPIRED']));
      const cancelledIds = plain(await readContract('get_market_ids_by_status', ['CANCELLED']));
      for (const id of [...ids, ...noIds, ...expiredIds, ...cancelledIds]) {
        try { await relayMarket(Number(id), logger); } catch (err) { logger.error({ err, marketId: id }, 'USDC relay failed; will retry'); }
      }
    } catch (err) { logger.error({ err }, 'Base USDC relay scan failed'); }
    finally { running = false; }
  };
  tick();
  setInterval(tick, Math.max(config.pollIntervalMs, 30000)).unref();
}
