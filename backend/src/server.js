import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config, assertConfig } from './config.js';
import { initDb } from './db.js';
import { startIndexer } from './indexer.js';
import { router } from './routes.js';

/**
 * EventWeaver API — 24/7 indexer + REST gateway for the EventWeaver
 * Intelligent Contract on GenLayer StudioNet.
 *
 * Availability posture: this process must never die.
 *  - uncaughtException / unhandledRejection are logged, not fatal.
 *  - The indexer loop is self-healing with backoff.
 *  - Fly.io keeps min 1 machine running with auto-restart + health checks.
 */

const logger = pino({ level: config.logLevel });

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException — continuing (24/7 posture)');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'unhandledRejection — continuing');
});

async function main() {
  assertConfig(logger);

  try {
    await initDb(logger);
  } catch (err) {
    logger.error({ err }, 'db init failed — starting anyway with memory store; will not crash');
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.use(router);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error({ err: err.message, url: req.url }, 'request error');
    res.status(500).json({ error: 'internal error' });
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info({ port: config.port, contract: config.contractAddress }, 'EventWeaver API up');
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;

  startIndexer(logger);

  // Graceful drain on deploy-driven restarts; Fly restarts us immediately.
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      logger.info({ sig }, 'draining connections');
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 8000).unref();
    });
  }
}

main().catch((err) => {
  // Absolute last resort: log and keep the event loop alive so Fly's
  // health check restarts us cleanly rather than crash-looping.
  logger.fatal({ err }, 'fatal boot error — holding process for supervisor');
  setInterval(() => {}, 60000);
});
