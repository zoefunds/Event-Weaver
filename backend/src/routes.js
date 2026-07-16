import { Router } from 'express';
import { listMarkets, getMarket, getActivity, getActorActivity, getStats, dbHealthy, hasDb } from './db.js';
import { readContract, plain } from './genlayer.js';
import { indexerState } from './indexer.js';
import { resolverState } from './resolver.js';
import { config } from './config.js';

export const router = Router();

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/** Liveness + readiness for Fly health checks. */
router.get('/health', asyncRoute(async (_req, res) => {
  const db = await dbHealthy();
  res.status(db ? 200 : 503).json({
    ok: db,
    db: hasDb() ? (db ? 'up' : 'down') : 'memory',
    indexer: {
      lastSyncAt: indexerState.lastSyncAt,
      lastError: indexerState.lastError,
      marketsIndexed: indexerState.marketsIndexed,
    },
    resolver: {
      lastRunAt: resolverState.lastRunAt,
      attempts: resolverState.attempts,
      resolved: resolverState.resolved,
      lastError: resolverState.lastError,
    },
    contract: config.contractAddress,
    uptimeSec: Math.floor(process.uptime()),
  });
}));

/** Market ids excluded from the public feed (legacy/demo), via env. */
const HIDDEN_IDS = new Set(
  (process.env.HIDE_MARKET_IDS ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n))
);

/** Indexed market list with filters (fast, serves the discovery page). */
router.get('/api/markets', asyncRoute(async (req, res) => {
  const { status, category } = req.query;
  const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 100);
  const offset = Math.max(parseInt(req.query.offset ?? '0', 10) || 0, 0);
  const rows = await listMarkets({ status, category, limit, offset });
  res.json(rows.filter((m) => !HIDDEN_IDS.has(m.id) && m.status !== 'CANCELLED'));
}));

/** Single market — indexed copy first, live chain fallback. */
router.get('/api/markets/:id', asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  let market = await getMarket(id);
  if (!market) {
    try {
      market = plain(await readContract('get_market', [id]));
    } catch {
      return res.status(404).json({ error: 'market not found' });
    }
  }
  res.json(market);
}));

/** Live-from-chain market read (bypasses index lag after a write). */
router.get('/api/markets/:id/live', asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    res.json(plain(await readContract('get_market', [id])));
  } catch {
    res.status(404).json({ error: 'market not found' });
  }
}));

router.get('/api/markets/:id/activity', asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  res.json(await getActivity(id, 50));
}));

router.get('/api/markets/:id/resolution', asyncRoute(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    res.json(plain(await readContract('get_resolution_report', [id])));
  } catch {
    res.status(404).json({ error: 'market not found' });
  }
}));

/** Portfolio: positions + quotes + balance + notifications for an address. */
router.get('/api/portfolio/:address', asyncRoute(async (req, res) => {
  const address = req.params.address;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return res.status(400).json({ error: 'invalid address' });
  }
  const [marketIdsRaw, balanceRaw] = await Promise.all([
    readContract('get_user_market_ids', [address]),
    readContract('get_balance_of', [address]),
  ]);
  const marketIds = plain(marketIdsRaw) ?? [];
  const positions = [];
  for (const id of marketIds) {
    try {
      const [pos, quote, market] = await Promise.all([
        readContract('get_position', [id, address]).then(plain),
        readContract('quote_payout', [id, address]).then(plain),
        getMarket(Number(id)).then((m) => m ?? readContract('get_market', [id]).then(plain)),
      ]);
      positions.push({ market_id: Number(id), position: pos, quote, market });
    } catch { /* skip unreadable position */ }
  }
  const notifications = await getActorActivity(address, 25);
  res.json({ address, balance: plain(balanceRaw), positions, notifications });
}));

router.get('/api/stats', asyncRoute(async (_req, res) => {
  res.json(await getStats());
}));

router.get('/api/config', asyncRoute(async (_req, res) => {
  res.json({
    contractAddress: config.contractAddress,
    network: 'studionet',
    chainConfig: plain(await readContract('get_config')),
    categories: plain(await readContract('get_categories')),
  });
}));
