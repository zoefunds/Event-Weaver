import { readContract, plain } from './genlayer.js';
import { upsertMarket, insertActivity, saveStats } from './db.js';
import { config } from './config.js';

/**
 * Resilient on-chain indexer. Polls the contract and mirrors markets,
 * activity, and platform stats into Postgres. Designed to NEVER take the
 * process down: every cycle is fully wrapped, failures back off
 * exponentially and recover automatically.
 */

export const indexerState = {
  lastSyncAt: null,
  lastError: null,
  consecutiveFailures: 0,
  marketsIndexed: 0,
  running: false,
};

async function syncOnce(logger) {
  const countRaw = await readContract('get_market_count');
  const count = Number(countRaw);
  const stats = plain(await readContract('get_platform_stats'));
  await saveStats(stats);

  for (let id = 0; id < count; id++) {
    try {
      const market = plain(await readContract('get_market', [id]));
      await upsertMarket(market);
      const activity = plain(await readContract('get_activity', [id, 0, 100]));
      if (Array.isArray(activity) && activity.length) {
        await insertActivity(id, activity);
      }
    } catch (err) {
      logger.warn({ err: err.message, id }, 'failed to index market (skipping)');
    }
  }
  indexerState.marketsIndexed = count;
  indexerState.lastSyncAt = new Date().toISOString();
  indexerState.lastError = null;
  indexerState.consecutiveFailures = 0;
}

export function startIndexer(logger) {
  indexerState.running = true;
  const loop = async () => {
    try {
      await syncOnce(logger);
      logger.debug({ markets: indexerState.marketsIndexed }, 'sync complete');
    } catch (err) {
      indexerState.consecutiveFailures += 1;
      indexerState.lastError = err.message;
      logger.error(
        { err: err.message, failures: indexerState.consecutiveFailures },
        'indexer cycle failed (will retry)'
      );
    } finally {
      const backoff = Math.min(indexerState.consecutiveFailures, 5) * 10000;
      setTimeout(loop, config.pollIntervalMs + backoff);
    }
  };
  loop();
  logger.info(
    { contract: config.contractAddress, intervalMs: config.pollIntervalMs },
    'indexer started'
  );
}
