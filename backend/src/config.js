import 'dotenv/config';

/** Central, validated configuration. Fails loudly on missing critical vars. */
export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  contractAddress: process.env.CONTRACT_ADDRESS ?? '0x0361b5a160637407e7D93Ff8C1CC866855dD0cc2',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '15000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  env: process.env.NODE_ENV ?? 'development',
};

export function assertConfig(logger) {
  if (!config.databaseUrl) {
    logger.warn('DATABASE_URL not set — running with in-memory fallback cache only');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress)) {
    throw new Error(`CONTRACT_ADDRESS is not a valid address: ${config.contractAddress}`);
  }
}
