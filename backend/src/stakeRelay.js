/** Stake relay: the bridge that turns a confirmed Base Sepolia USDC deposit
 * into a GenLayer position — the only path that ever creates one (see
 * `record_stake` in contracts/event_weaver.py).
 *
 * This closes two gaps in the old design:
 *  1. A recorded stake used to trust a client-supplied `amount` with no
 *     check that any USDC had actually moved. Now GenLayer only accepts
 *     record_stake() from this relayer, and this relayer only calls it after
 *     independently observing a finalized `Staked` event on Base Sepolia —
 *     so every position is backed by a real, confirmed payment, including a
 *     deposit made directly against the escrow contract by anyone
 *     interacting outside the website.
 *  2. If the escrow deposit succeeded but the GenLayer write never landed
 *     (crash, RPC hiccup, rate limit), the old flow left the user's USDC
 *     deposited with no stake and no automated recovery. Now the deposit is
 *     durably recorded in `pending_stakes` the moment it confirms, and this
 *     loop retries every row that isn't 'applied' yet, forever, independent
 *     of whether the user's browser is even open.
 *
 * Two phases run every tick:
 *   scanForDeposits — reads new confirmed `Staked` events into pending_stakes.
 *   applyPendingStakes — calls record_stake() for every unapplied row.
 */
import { Contract, JsonRpcProvider } from 'ethers';
import { createClient as createGenlayerClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { config } from './config.js';
import { readContract, plain } from './genlayer.js';
import {
  getSyncState,
  setSyncState,
  insertPendingStakes,
  listUnappliedStakes,
  markStakeApplied,
  markStakeFailed,
} from './db.js';

const ESCROW_ABI = [
  'event Staked(uint256 indexed marketId, address indexed staker, uint8 side, uint256 amount)',
];
const LAST_BLOCK_KEY = 'stakeRelay:lastScannedBlock';
const MAX_BLOCK_RANGE = 2000; // stay well under typical RPC log-range caps

function provider() {
  return new JsonRpcProvider(config.baseSepolia.rpcUrl);
}

let genlayerWriteClient = null;
function getGenlayerWriteClient(logger) {
  if (genlayerWriteClient) return genlayerWriteClient;
  if (!config.baseSepolia.relayerPrivateKey) return null;
  const account = createAccount(config.baseSepolia.relayerPrivateKey);
  genlayerWriteClient = createGenlayerClient({ chain: studionet, account });
  logger.info({ relayer: account.address }, 'stake relayer GenLayer account ready');
  return genlayerWriteClient;
}

export function isStakeRelayConfigured() {
  return Boolean(config.baseSepolia.relayerPrivateKey);
}

/** Scan new, confirmed `Staked` events into pending_stakes. Never re-derives
 * a smaller confirmation depth than configured — a reorg-affected deposit
 * simply isn't scanned yet, it is never un-recorded once seen. */
export async function scanForDeposits(logger) {
  const p = provider();
  const escrow = new Contract(config.baseSepolia.escrowAddress, ESCROW_ABI, p);
  const head = await p.getBlockNumber();
  const safeHead = head - config.baseSepolia.stakeConfirmations;
  if (safeHead < 0) return;

  const stored = await getSyncState(LAST_BLOCK_KEY);
  const fromBlock = stored ? Number(stored) + 1 : Math.max(0, safeHead - MAX_BLOCK_RANGE);
  if (fromBlock > safeHead) return;
  const toBlock = Math.min(safeHead, fromBlock + MAX_BLOCK_RANGE);

  const events = await escrow.queryFilter(escrow.filters.Staked(), fromBlock, toBlock);
  if (events.length) {
    const rows = events.map((ev) => ({
      baseTxHash: ev.transactionHash.toLowerCase(),
      marketId: Number(ev.args.marketId),
      staker: ev.args.staker,
      side: Number(ev.args.side),
      amount: ev.args.amount.toString(),
      blockNumber: ev.blockNumber,
    }));
    await insertPendingStakes(rows);
    logger.info({ count: rows.length, fromBlock, toBlock }, 'confirmed USDC deposits detected');
  }
  await setSyncState(LAST_BLOCK_KEY, String(toBlock));
}

/** Apply every unapplied confirmed deposit to GenLayer. Failures increment
 * `attempts` and are retried next tick indefinitely — this is the recovery
 * path for "payment succeeded, next step failed". */
export async function applyPendingStakes(logger) {
  const client = getGenlayerWriteClient(logger);
  if (!client) return;
  const rows = await listUnappliedStakes(25);
  for (const row of rows) {
    try {
      const alreadyApplied = await readContract('is_stake_applied', [row.base_tx_hash]);
      if (alreadyApplied) {
        // GenLayer already has it (e.g. a prior attempt's receipt wait timed
        // out after the write actually landed) — reconcile without retrying.
        await markStakeApplied(row.base_tx_hash, null);
        continue;
      }
      const hash = await client.writeContract({
        address: config.contractAddress,
        functionName: 'record_stake',
        args: [Number(row.market_id), row.staker, Number(row.side), Number(row.amount), row.base_tx_hash],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash,
        status: 'ACCEPTED',
        interval: 3000,
        retries: 60,
      });
      await markStakeApplied(row.base_tx_hash, hash);
      logger.info({ baseTxHash: row.base_tx_hash, marketId: row.market_id }, 'stake applied to GenLayer');
    } catch (err) {
      await markStakeFailed(row.base_tx_hash, err.message);
      logger.error({ err: err.message, baseTxHash: row.base_tx_hash }, 'stake apply failed; will retry');
    }
  }
}

export function startStakeRelay(logger) {
  if (!isStakeRelayConfigured()) {
    logger.warn('Stake relayer disabled: BASE_SEPOLIA_RELAYER_PRIVATE_KEY is not set');
    return;
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await scanForDeposits(logger);
      await applyPendingStakes(logger);
    } catch (err) {
      logger.error({ err }, 'stake relay tick failed');
    } finally {
      running = false;
    }
  };
  tick();
  setInterval(tick, Math.max(config.pollIntervalMs, 15000)).unref();
}
