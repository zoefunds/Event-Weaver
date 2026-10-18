/** Base Sepolia settlement relay. It reads the immutable GenLayer result and
 * credits claims in EventWeaverEscrow; it never holds a user's USDC. */
import { AbiCoder, Contract, JsonRpcProvider, Wallet, getBytes, keccak256, toUtf8Bytes } from 'ethers';
import { config } from './config.js';
import { plain, readContract } from './genlayer.js';

const ABI = [
  'function settle(uint256 marketId, address[] recipients, uint256[] amounts, bytes32 verdictHash, bytes authoritySignature)',
  'function settlementDigest(uint256 marketId, address[] recipients, uint256[] amounts, bytes32 verdictHash) view returns (bytes32)',
  'function allocateLateRefund(uint256 marketId, bytes32 depositId, address recipient, uint256 amount, bytes authoritySignature)',
  'function appliedLateRefund(bytes32 depositId) view returns (bool)',
  'function pools(uint256 marketId) view returns (uint256 deposited, uint256 allocated, bool settled)',
  'function claimable(uint256 marketId, address recipient) view returns (uint256)',
];
const TERMINAL = new Set(['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED']);

function contract() {
  if (!config.baseSepolia.relayerPrivateKey) throw new Error('BASE_SEPOLIA_RELAYER_PRIVATE_KEY is not configured');
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  return new Contract(config.baseSepolia.escrowAddress, ABI, new Wallet(config.baseSepolia.relayerPrivateKey, provider));
}

function authority() {
  if (!config.baseSepolia.settlementAuthorityPrivateKey) throw new Error('SETTLEMENT_AUTHORITY_PRIVATE_KEY is not configured');
  return new Wallet(config.baseSepolia.settlementAuthorityPrivateKey);
}

/** Read the current payout from Base, which is authoritative after a user has
 * claimed. GenLayer retains the outcome quote but cannot observe an EVM claim. */
export async function getBaseClaimable(marketId, recipient) {
  const provider = new JsonRpcProvider(config.baseSepolia.rpcUrl);
  const escrow = new Contract(config.baseSepolia.escrowAddress, ABI, provider);
  return (await escrow.claimable(marketId, recipient)).toString();
}

export function isBaseRelayConfigured() { return Boolean(config.baseSepolia.relayerPrivateKey && config.baseSepolia.settlementAuthorityPrivateKey); }

export async function isBaseMarketSettled(marketId) {
  return Boolean((await contract().pools(marketId)).settled);
}

export async function relayMarket(marketId, logger) {
  const market = plain(await readContract('get_market', [marketId]));
  if (!TERMINAL.has(market.status)) return false;
  const escrow = contract();
  const pool = await escrow.pools(marketId);
  if (pool.settled) return false;
  const payouts = plain(await readContract('get_base_payouts', [marketId]));
  if (!payouts.length) throw new Error(`market ${marketId}: terminal verdict produced no safe terminal allocation`);
  const recipients = payouts.map((row) => row.address);
  const amounts = payouts.map((row) => BigInt(row.amount));
  const allocated = amounts.reduce((total, amount) => total + amount, 0n);
  if (allocated > pool.deposited) {
    throw new Error(`market ${marketId}: Base escrow has ${pool.deposited}, but GenLayer allocated ${allocated}`);
  }
  const report = plain(await readContract('get_resolution_report', [marketId]));
  const verdictHash = keccak256(toUtf8Bytes(JSON.stringify({
    marketId, status: report.status, resolvedTs: report.resolved_ts,
    summary: report.resolution_summary, steps: report.steps,
  })));
  // Sign the unprefixed typed payload; Wallet.signMessage and the escrow's
  // verifier apply the same EIP-191 prefix exactly once.
  const payoutsHash = keccak256(AbiCoder.defaultAbiCoder().encode(['address[]', 'uint256[]'], [recipients, amounts]));
  const typeHash = keccak256(toUtf8Bytes('EventWeaverSettlement(uint256 chainId,address escrow,uint256 marketId,bytes32 payoutsHash,bytes32 verdictHash,uint256 deposited)'));
  const network = await escrow.runner.provider.getNetwork();
  const inner = keccak256(AbiCoder.defaultAbiCoder().encode(
    ['bytes32','uint256','address','uint256','bytes32','bytes32','uint256'],
    [typeHash, network.chainId, await escrow.getAddress(), marketId, payoutsHash, verdictHash, pool.deposited]
  ));
  const canonicalSignature = await authority().signMessage(getBytes(inner));
  const tx = await escrow.settle(marketId, recipients, amounts, verdictHash, canonicalSignature);
  logger.info({ marketId, txHash: tx.hash, recipientCount: recipients.length }, 'relaying USDC payouts to Base Sepolia');
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Base settlement failed for market ${marketId}`);
  return true;
}

/** Complete the cross-chain recovery path even if one-time settlement already
 * happened before a delayed deposit was recorded on GenLayer. */
export async function relayLateRefund(row, logger) {
  const escrow = contract();
  const pool = await escrow.pools(Number(row.market_id));
  if (!pool.settled) return false;
  const depositHash = keccak256(toUtf8Bytes(row.deposit_id));
  if (await escrow.appliedLateRefund(depositHash)) return true;
  const typeHash = keccak256(toUtf8Bytes('EventWeaverLateRefund(uint256 chainId,address escrow,uint256 marketId,bytes32 depositId,address recipient,uint256 amount)'));
  const network = await escrow.runner.provider.getNetwork();
  const inner = keccak256(AbiCoder.defaultAbiCoder().encode(
    ['bytes32','uint256','address','uint256','bytes32','address','uint256'],
    [typeHash, network.chainId, await escrow.getAddress(), Number(row.market_id), depositHash, row.staker, BigInt(row.amount)]
  ));
  const signature = await authority().signMessage(getBytes(inner));
  const tx = await escrow.allocateLateRefund(Number(row.market_id), depositHash, row.staker, BigInt(row.amount), signature);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`late refund allocation failed for ${row.deposit_id}`);
  logger.info({ depositId: row.deposit_id, txHash: tx.hash }, 'late deposit refund allocated on Base');
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
