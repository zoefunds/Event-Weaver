import { createClient, createAccount, generatePrivateKey } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readContract, plain } from './genlayer.js';
import { config } from './config.js';

/**
 * Automatic deadline resolver.
 *
 * Adjudication policy (mirrors the contract):
 *  - before a market's deadline, only its creator / platform owner may
 *    trigger checks;
 *  - after the deadline adjudication is permissionless — this service is
 *    the platform's automatic trigger, so users never have to press a
 *    button to get their market resolved.
 *
 * The resolver account needs no funds on gasless StudioNet; set
 * RESOLVER_PRIVATE_KEY to pin a stable identity, otherwise an ephemeral
 * key is generated at boot (fine, since post-deadline calls are
 * permissionless).
 */

const RETRY_COOLDOWN_MS = 10 * 60 * 1000; // per-market attempt spacing
const lastAttempt = new Map(); // marketId -> epoch ms

export const resolverState = {
  address: null,
  lastRunAt: null,
  resolved: 0,
  attempts: 0,
  lastError: null,
};

let writeClient = null;

function getWriteClient(logger) {
  if (writeClient) return writeClient;
  const pk = process.env.RESOLVER_PRIVATE_KEY ?? generatePrivateKey();
  const account = createAccount(pk);
  resolverState.address = account.address;
  writeClient = createClient({ chain: studionet, account });
  logger.info({ resolver: account.address }, 'auto-resolver account ready');
  return writeClient;
}

async function resolveDueMarkets(logger) {
  const now = Math.floor(Date.now() / 1000);
  const count = Number(await readContract('get_market_count'));

  for (let id = 0; id < count; id++) {
    try {
      const market = plain(await readContract('get_market', [id]));
      const active = market.status === 'OPEN' || market.status === 'RESOLVING';
      const due = Number(market.deadline_ts) < now;
      if (!active || !due) continue;

      const last = lastAttempt.get(id) ?? 0;
      if (Date.now() - last < RETRY_COOLDOWN_MS) continue;
      lastAttempt.set(id, Date.now());

      const client = getWriteClient(logger);
      logger.info({ id, title: market.title }, 'deadline passed — auto-adjudicating');
      resolverState.attempts += 1;

      // Full adjudication pass; if the chain stays undecided the contract
      // will EXPIRE the market (deadline passed), settling to NO.
      const hash = await client.writeContract({
        address: config.contractAddress,
        functionName: 'request_resolution',
        args: [id],
        value: 0n,
      });
      await client.waitForTransactionReceipt({
        hash,
        status: 'ACCEPTED',
        interval: 5000,
        retries: 60,
      });

      const after = plain(await readContract('get_market', [id]));
      if (after.status !== 'OPEN' && after.status !== 'RESOLVING') {
        resolverState.resolved += 1;
        logger.info({ id, outcome: after.status }, 'market auto-resolved');
      }
    } catch (err) {
      resolverState.lastError = err.message;
      logger.warn({ id, err: err.message }, 'auto-resolve attempt failed (will retry)');
    }
  }
  resolverState.lastRunAt = new Date().toISOString();
}

export function startResolver(logger) {
  const intervalMs = parseInt(process.env.RESOLVER_INTERVAL_MS ?? '300000', 10);
  const loop = async () => {
    try {
      await resolveDueMarkets(logger);
    } catch (err) {
      resolverState.lastError = err.message;
      logger.error({ err: err.message }, 'resolver cycle failed (will retry)');
    } finally {
      setTimeout(loop, intervalMs);
    }
  };
  loop();
  logger.info({ intervalMs }, 'auto-resolver started');
}
