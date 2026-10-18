import 'dotenv/config';

/** Central, validated configuration. Fails loudly on missing critical vars. */
export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  databaseUrl: process.env.DATABASE_URL ?? '',
  contractAddress: process.env.CONTRACT_ADDRESS ?? '0xB780213B7c1b47cd07913aC83f42371Be2E1bdD3',
  // StudioNet's shared RPC is capped at 500 reads/hour. Five minutes keeps
  // indexing, resolution, and settlement well below that budget.
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '300000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((s) => s.trim()),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  env: process.env.NODE_ENV ?? 'development',
  baseSepolia: {
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
    usdcAddress: process.env.BASE_SEPOLIA_USDC ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    escrowAddress: process.env.BASE_ESCROW_ADDRESS ?? '0xe9edA1549aFcaCB073C86668f84E2A619F4f50cD',
    escrowDeploymentBlock: parseInt(process.env.BASE_ESCROW_DEPLOYMENT_BLOCK ?? '0', 10),
    // Transaction-only key: submits confirmed deposits to GenLayer and
    // authority-approved payloads to Base. It cannot produce authority
    // signatures; that key exists only in the separate signer service.
    relayerPrivateKey: process.env.BASE_SEPOLIA_RELAYER_PRIVATE_KEY ?? '',
    // Blocks to wait behind the chain head before treating a `Staked`
    // deposit as final. Base Sepolia reorgs beyond a handful of blocks are
    // not realistic, but this keeps the relayer from recording a stake for
    // a deposit that later gets reorged out.
    stakeConfirmations: parseInt(process.env.BASE_SEPOLIA_STAKE_CONFIRMATIONS ?? '5', 10),
  },
  settlementSigner: {
    url: (process.env.SETTLEMENT_SIGNER_URL ?? '').replace(/\/$/, ''),
    token: process.env.SETTLEMENT_SIGNER_TOKEN ?? '',
  },
};

export function assertConfig(logger) {
  if (!config.databaseUrl) {
    logger.warn('DATABASE_URL not set — running with in-memory fallback cache only');
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(config.contractAddress)) {
    throw new Error(`CONTRACT_ADDRESS is not a valid address: ${config.contractAddress}`);
  }
  if (config.baseSepolia.relayerPrivateKey && config.baseSepolia.escrowDeploymentBlock <= 0) {
    throw new Error('BASE_ESCROW_DEPLOYMENT_BLOCK must identify the escrow deployment block when the relay is enabled');
  }
  if (Boolean(config.settlementSigner.url) !== Boolean(config.settlementSigner.token)) {
    throw new Error('SETTLEMENT_SIGNER_URL and SETTLEMENT_SIGNER_TOKEN must be configured together');
  }
}
