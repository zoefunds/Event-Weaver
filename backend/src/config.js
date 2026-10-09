import 'dotenv/config';

/** Central, validated configuration. Fails loudly on missing critical vars. */
export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  contractAddress: process.env.CONTRACT_ADDRESS ?? '0x764481a6D14eE61Dad5Ec0B8249f9Eec0F4Ad0d6',
  // StudioNet's shared RPC is capped at 500 reads/hour. Five minutes keeps
  // indexing, resolution, and settlement well below that budget.
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '300000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  env: process.env.NODE_ENV ?? 'development',
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
    usdcAddress: process.env.BASE_SEPOLIA_USDC ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    escrowAddress: process.env.BASE_ESCROW_ADDRESS ?? '0x83D73b3217314aF32D833e18d90356299835d0a5',
    // Same key signs both halves of the stake relay: it is the escrow's
    // trusted `relayer` (settle()) and, via createAccount(), the GenLayer
    // contract's trusted `relayer` (record_stake()) — one operational
    // identity that only ever acts on deposits/outcomes it has independently
    // confirmed on-chain.
    relayerPrivateKey: process.env.BASE_SEPOLIA_RELAYER_PRIVATE_KEY ?? '',
    // Blocks to wait behind the chain head before treating a `Staked`
    // deposit as final. Base Sepolia reorgs beyond a handful of blocks are
    // not realistic, but this keeps the relayer from recording a stake for
    // a deposit that later gets reorged out.
    stakeConfirmations: parseInt(process.env.BASE_SEPOLIA_STAKE_CONFIRMATIONS ?? '5', 10),
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
