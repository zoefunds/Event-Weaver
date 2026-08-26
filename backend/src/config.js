import 'dotenv/config';

/** Central, validated configuration. Fails loudly on missing critical vars. */
export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  contractAddress: process.env.CONTRACT_ADDRESS ?? '0x96727fd9E35036903B89829E1349dB5A83e7c48f',
  // StudioNet's shared RPC is capped at 500 reads/hour. Five minutes keeps
  // indexing, resolution, and settlement well below that budget.
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '300000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  env: process.env.NODE_ENV ?? 'development',
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
    usdcAddress: process.env.BASE_SEPOLIA_USDC ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    escrowAddress: process.env.BASE_ESCROW_ADDRESS ?? '0x23Aca542DFE6FEF14d29A5184818a954eafA7B9C',
    relayerPrivateKey: process.env.BASE_SEPOLIA_RELAYER_PRIVATE_KEY ?? '',
  },
};

export function assertConfig(logger) {
  if (!config.databaseUrl) {
    logger.warn('DATABASE_URL not set — running with in-memory fallback cache only');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress)) {
    throw new Error(`CONTRACT_ADDRESS is not a valid address: ${config.contractAddress}`);
  }
}
