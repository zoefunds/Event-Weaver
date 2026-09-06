import pg from 'pg';
import { config } from './config.js';

/**
 * Postgres layer. The database is a queryable mirror of on-chain state —
 * the contract remains the source of truth. If DATABASE_URL is absent
 * (local dev), a transparent in-memory store keeps the API functional.
 */

let pool = null;

const memory = {
  markets: new Map(),
  activity: new Map(), // marketId -> rows
  stats: {},
  pendingStakes: new Map(), // base_tx_hash -> row
};

export function hasDb() {
  return pool !== null;
}

export async function initDb(logger) {
  if (!config.databaseUrl) return;
  pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    // Fly Postgres (both legacy Nomad and flex) does not terminate TLS on
    // its private-network connections — the WireGuard mesh is the transport
    // encryption. Only opt into TLS when the URL explicitly asks for it.
    ssl: /[?&]sslmode=require\b/.test(config.databaseUrl)
      ? { rejectUnauthorized: false }
      : false,
  });
  pool.on('error', (err) => logger.error({ err }, 'pg pool error (recovered)'));

  await pool.query(`
    CREATE TABLE IF NOT EXISTS markets (
      id           BIGINT PRIMARY KEY,
      data         JSONB NOT NULL,
      status       TEXT NOT NULL,
      category     TEXT NOT NULL,
      total_pool   NUMERIC NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_markets_status   ON markets (status);
    CREATE INDEX IF NOT EXISTS idx_markets_category ON markets (category);

    CREATE TABLE IF NOT EXISTS activity (
      id         BIGSERIAL PRIMARY KEY,
      market_id  BIGINT NOT NULL,
      kind       TEXT NOT NULL,
      actor      TEXT NOT NULL,
      amount     NUMERIC NOT NULL DEFAULT 0,
      ts         BIGINT NOT NULL,
      note       TEXT NOT NULL DEFAULT '',
      UNIQUE (market_id, kind, actor, amount, ts, note)
    );
    CREATE INDEX IF NOT EXISTS idx_activity_market ON activity (market_id, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_actor  ON activity (actor, ts DESC);

    CREATE TABLE IF NOT EXISTS platform_stats (
      id         INT PRIMARY KEY DEFAULT 1,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- One row per confirmed Base Sepolia escrow deposit ("Staked" event),
    -- from detection through GenLayer application. This is what makes the
    -- "payment succeeded but the next step failed" case recoverable: the
    -- deposit is durably recorded the moment it is confirmed on-chain,
    -- independent of whether the GenLayer write ever lands, and the relay
    -- loop keeps retrying every row that isn't 'applied' yet.
    CREATE TABLE IF NOT EXISTS pending_stakes (
      base_tx_hash TEXT PRIMARY KEY,
      market_id    BIGINT NOT NULL,
      staker       TEXT NOT NULL,
      side         SMALLINT NOT NULL,
      amount       NUMERIC NOT NULL,
      block_number BIGINT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'confirmed_onchain',
      attempts     INT NOT NULL DEFAULT 0,
      last_error   TEXT,
      genlayer_tx_hash TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_pending_stakes_status ON pending_stakes (status);
    CREATE INDEX IF NOT EXISTS idx_pending_stakes_staker ON pending_stakes (lower(staker));
  `);
  logger.info('database migrated and ready');
}

export async function upsertMarket(market) {
  if (!pool) {
    memory.markets.set(market.id, market);
    return;
  }
  await pool.query(
    `INSERT INTO markets (id, data, status, category, total_pool, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE
       SET data = $2, status = $3, category = $4, total_pool = $5, updated_at = now()`,
    [market.id, market, market.status, market.category, market.total_pool ?? 0]
  );
}

export async function insertActivity(marketId, rows) {
  if (!pool) {
    memory.activity.set(marketId, rows);
    return;
  }
  for (const r of rows) {
    await pool.query(
      `INSERT INTO activity (market_id, kind, actor, amount, ts, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [marketId, r.kind, r.actor, r.amount, r.ts, r.note ?? '']
    );
  }
}

/** Drop cached markets/activity whose id is no longer part of the live
 * contract's range (e.g. leftover rows from a prior contract deployment
 * pointed at by this same database). `count` is the current on-chain
 * market_count — valid ids are [0, count). */
export async function pruneMarketsAbove(count) {
  if (!pool) {
    for (const id of memory.markets.keys()) {
      if (id >= count) memory.markets.delete(id);
    }
    for (const id of memory.activity.keys()) {
      if (id >= count) memory.activity.delete(id);
    }
    return;
  }
  await pool.query('DELETE FROM activity WHERE market_id >= $1', [count]);
  await pool.query('DELETE FROM markets WHERE id >= $1', [count]);
}

export async function saveStats(stats) {
  if (!pool) {
    memory.stats = stats;
    return;
  }
  await pool.query(
    `INSERT INTO platform_stats (id, data, updated_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET data = $1, updated_at = now()`,
    [stats]
  );
}

export async function listMarkets({ status, category, limit = 50, offset = 0 }) {
  if (!pool) {
    let rows = [...memory.markets.values()];
    if (status) rows = rows.filter((m) => m.status === status);
    if (category) rows = rows.filter((m) => m.category === category);
    return rows.sort((a, b) => b.id - a.id).slice(offset, offset + limit);
  }
  const clauses = [];
  const params = [];
  if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
  if (category) { params.push(category); clauses.push(`category = $${params.length}`); }
  params.push(limit, offset);
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const res = await pool.query(
    `SELECT data FROM markets ${where} ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return res.rows.map((r) => r.data);
}

export async function getMarket(id) {
  if (!pool) return memory.markets.get(id) ?? null;
  const res = await pool.query('SELECT data FROM markets WHERE id = $1', [id]);
  return res.rows[0]?.data ?? null;
}

export async function getActivity(marketId, limit = 50) {
  if (!pool) return memory.activity.get(marketId) ?? [];
  const res = await pool.query(
    'SELECT kind, actor, amount, ts, note FROM activity WHERE market_id = $1 ORDER BY ts DESC LIMIT $2',
    [marketId, limit]
  );
  return res.rows;
}

export async function getActorActivity(actor, limit = 50) {
  if (!pool) {
    const all = [...memory.activity.values()].flat();
    return all.filter((r) => r.actor?.toLowerCase() === actor.toLowerCase()).slice(0, limit);
  }
  const res = await pool.query(
    'SELECT market_id, kind, actor, amount, ts, note FROM activity WHERE lower(actor) = lower($1) ORDER BY ts DESC LIMIT $2',
    [actor, limit]
  );
  return res.rows;
}

export async function getStats() {
  if (!pool) return memory.stats;
  const res = await pool.query('SELECT data FROM platform_stats WHERE id = 1');
  return res.rows[0]?.data ?? {};
}

export async function getSyncState(key) {
  if (!pool) return memory[`sync:${key}`] ?? null;
  const res = await pool.query('SELECT value FROM sync_state WHERE key = $1', [key]);
  return res.rows[0]?.value ?? null;
}

export async function setSyncState(key, value) {
  if (!pool) {
    memory[`sync:${key}`] = value;
    return;
  }
  await pool.query(
    `INSERT INTO sync_state (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value]
  );
}

/** Insert newly-detected confirmed deposits. Idempotent on base_tx_hash —
 * re-scanning the same block range (e.g. after a restart) is always safe. */
export async function insertPendingStakes(rows) {
  if (!rows.length) return;
  if (!pool) {
    for (const r of rows) {
      if (!memory.pendingStakes.has(r.baseTxHash)) {
        memory.pendingStakes.set(r.baseTxHash, {
          base_tx_hash: r.baseTxHash,
          market_id: r.marketId,
          staker: r.staker,
          side: r.side,
          amount: r.amount,
          block_number: r.blockNumber,
          status: 'confirmed_onchain',
          attempts: 0,
          last_error: null,
          genlayer_tx_hash: null,
        });
      }
    }
    return;
  }
  for (const r of rows) {
    await pool.query(
      `INSERT INTO pending_stakes (base_tx_hash, market_id, staker, side, amount, block_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (base_tx_hash) DO NOTHING`,
      [r.baseTxHash, r.marketId, r.staker, r.side, r.amount, r.blockNumber]
    );
  }
}

export async function listUnappliedStakes(limit = 25) {
  if (!pool) {
    return [...memory.pendingStakes.values()]
      .filter((r) => r.status !== 'applied')
      .slice(0, limit);
  }
  const res = await pool.query(
    `SELECT * FROM pending_stakes WHERE status != 'applied' ORDER BY block_number ASC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

export async function markStakeApplied(baseTxHash, genlayerTxHash) {
  if (!pool) {
    const row = memory.pendingStakes.get(baseTxHash);
    if (row) { row.status = 'applied'; row.genlayer_tx_hash = genlayerTxHash; row.last_error = null; }
    return;
  }
  await pool.query(
    `UPDATE pending_stakes SET status = 'applied', genlayer_tx_hash = $2, last_error = NULL, updated_at = now()
     WHERE base_tx_hash = $1`,
    [baseTxHash, genlayerTxHash]
  );
}

export async function markStakeFailed(baseTxHash, errorMessage) {
  if (!pool) {
    const row = memory.pendingStakes.get(baseTxHash);
    if (row) { row.attempts += 1; row.last_error = errorMessage; row.status = 'retry_pending'; }
    return;
  }
  await pool.query(
    `UPDATE pending_stakes SET attempts = attempts + 1, last_error = $2, status = 'retry_pending', updated_at = now()
     WHERE base_tx_hash = $1`,
    [baseTxHash, errorMessage]
  );
}

export async function getStakeByTxHash(baseTxHash) {
  if (!pool) return memory.pendingStakes.get(baseTxHash) ?? null;
  const res = await pool.query('SELECT * FROM pending_stakes WHERE base_tx_hash = $1', [baseTxHash]);
  return res.rows[0] ?? null;
}

export async function listStakesForAddress(address, limit = 50) {
  if (!pool) {
    return [...memory.pendingStakes.values()]
      .filter((r) => r.staker?.toLowerCase() === address.toLowerCase())
      .slice(0, limit);
  }
  const res = await pool.query(
    'SELECT * FROM pending_stakes WHERE lower(staker) = lower($1) ORDER BY created_at DESC LIMIT $2',
    [address, limit]
  );
  return res.rows;
}

export async function dbHealthy() {
  if (!pool) return true;
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
