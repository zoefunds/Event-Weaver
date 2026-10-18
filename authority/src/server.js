import 'dotenv/config';
import express from 'express';
import { AbiCoder, Contract, Interface, JsonRpcProvider, Wallet, getBytes, getAddress, keccak256, toUtf8Bytes } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { assertCanonicalSettlement, canonicalJson } from './policy.js';

const cfg = {
  port: Number(process.env.PORT ?? 8080),
  token: process.env.AUTHORITY_API_TOKEN ?? '',
  privateKey: process.env.SETTLEMENT_AUTHORITY_PRIVATE_KEY ?? '',
  genLayerContract: process.env.GENLAYER_CONTRACT_ADDRESS ?? '',
  escrow: process.env.BASE_ESCROW_ADDRESS ?? '',
  baseRpc: process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org',
};
for (const [key, value] of Object.entries(cfg)) if ((key !== 'port' && key !== 'baseRpc') && !value) throw new Error(`missing ${key}`);

const genlayer = createClient({ chain: studionet });
const provider = new JsonRpcProvider(cfg.baseRpc);
const authority = new Wallet(cfg.privateKey);
const escrowAbi = [
  'event Staked(uint256 indexed marketId, address indexed staker, uint8 side, uint256 amount)',
  'function genLayerContract() view returns (address)',
  'function registeredMarketHash(uint256 marketId) view returns (bytes32)',
  'function handledDeposit(bytes32 depositId) view returns (bool)',
  'function pools(uint256 marketId) view returns (uint256 deposited, uint256 allocated, uint256 pending, bool settled)',
];
const escrow = new Contract(cfg.escrow, escrowAbi, provider);
const stakeInterface = new Interface(escrowAbi);

function plain(value) {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  return value;
}
async function read(functionName, args = []) {
  return plain(await genlayer.readContract({ address: cfg.genLayerContract, functionName, args }));
}
async function signInner(types, values) {
  const inner = keccak256(AbiCoder.defaultAbiCoder().encode(types, values));
  return authority.signMessage(getBytes(inner));
}
async function context() {
  const network = await provider.getNetwork();
  if (getAddress(await escrow.genLayerContract()) !== getAddress(cfg.genLayerContract)) throw new Error('escrow is bound to a different GenLayer contract');
  return { chainId: network.chainId, escrowAddress: await escrow.getAddress() };
}
async function verifiedDeposit(body) {
  const expectedId = `${String(body.baseTxHash).toLowerCase()}:${Number(body.logIndex)}`;
  if (body.depositId !== expectedId) throw new Error('deposit id does not match transaction and log index');
  const receipt = await provider.getTransactionReceipt(body.baseTxHash);
  if (!receipt || receipt.status !== 1) throw new Error('Base deposit transaction is not successful');
  const log = receipt.logs.find((item) => Number(item.index) === Number(body.logIndex));
  if (!log || getAddress(log.address) !== getAddress(cfg.escrow)) throw new Error('deposit log not emitted by canonical escrow');
  const parsed = stakeInterface.parseLog(log);
  if (!parsed || parsed.name !== 'Staked' || Number(parsed.args.marketId) !== Number(body.marketId)
      || getAddress(parsed.args.staker) !== getAddress(body.recipient) || parsed.args.amount !== BigInt(body.amount)) {
    throw new Error('deposit payload does not match canonical Staked log');
  }
  return keccak256(toUtf8Bytes(body.depositId));
}

const app = express();
app.use(express.json({ limit: '32kb' }));
app.get('/health', (_req, res) => res.json({ ok: true, authority: authority.address, contract: cfg.genLayerContract, escrow: cfg.escrow }));
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${cfg.token}`) return res.status(401).json({ error: 'unauthorized' });
  next();
});

app.post('/v1/register-market', async (req, res, next) => {
  try {
    const marketId = Number(req.body.marketId);
    const count = Number(await read('get_market_count'));
    if (!Number.isInteger(marketId) || marketId < 0 || marketId >= count) throw new Error('GenLayer market does not exist');
    const market = await read('get_market', [marketId]);
    if (Number(market.id) !== marketId) throw new Error('canonical market identity mismatch');
    const marketHash = keccak256(toUtf8Bytes(canonicalJson(market)));
    const { chainId, escrowAddress } = await context();
    const typeHash = keccak256(toUtf8Bytes('EventWeaverMarketRegistration(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 marketHash)'));
    const signature = await signInner(['bytes32','uint256','address','address','uint256','bytes32'], [typeHash, chainId, escrowAddress, cfg.genLayerContract, marketId, marketHash]);
    res.json({ marketId, marketHash, signature });
  } catch (err) { next(err); }
});

app.post('/v1/acknowledge-deposit', async (req, res, next) => {
  try {
    const body = req.body; const depositHash = await verifiedDeposit(body);
    if (!await read('is_stake_applied', [body.depositId])) throw new Error('deposit is not finalized in canonical GenLayer state');
    if (await escrow.handledDeposit(depositHash)) throw new Error('deposit already handled');
    const applicationHash = keccak256(toUtf8Bytes(`GENLAYER_FINAL_STATE:${cfg.genLayerContract.toLowerCase()}:${body.depositId}`));
    const { chainId, escrowAddress } = await context();
    const typeHash = keccak256(toUtf8Bytes('EventWeaverDepositAcknowledgement(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 depositId,address recipient,uint256 amount,bytes32 applicationHash)'));
    const signature = await signInner(
      ['bytes32','uint256','address','address','uint256','bytes32','address','uint256','bytes32'],
      [typeHash, chainId, escrowAddress, cfg.genLayerContract, Number(body.marketId), depositHash, body.recipient, BigInt(body.amount), applicationHash]
    );
    res.json({ applicationHash, signature });
  } catch (err) { next(err); }
});

app.post('/v1/refund-deposit', async (req, res, next) => {
  try {
    const body = req.body; const depositHash = await verifiedDeposit(body);
    if (await escrow.handledDeposit(depositHash)) throw new Error('deposit already handled');
    const applied = await read('is_stake_applied', [body.depositId]);
    const marketCount = Number(await read('get_market_count'));
    const chainConfig = await read('get_config');
    if (applied || (Number(body.marketId) < marketCount && !chainConfig.paused)) {
      throw new Error('refund policy requires an unapplied deposit and absent market or emergency pause');
    }
    const reasonHash = keccak256(toUtf8Bytes(String(body.reason)));
    const { chainId, escrowAddress } = await context();
    const typeHash = keccak256(toUtf8Bytes('EventWeaverDepositRefund(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 depositId,address recipient,uint256 amount,bytes32 reasonHash)'));
    const signature = await signInner(
      ['bytes32','uint256','address','address','uint256','bytes32','address','uint256','bytes32'],
      [typeHash, chainId, escrowAddress, cfg.genLayerContract, Number(body.marketId), depositHash, body.recipient, BigInt(body.amount), reasonHash]
    );
    res.json({ reasonHash, signature });
  } catch (err) { next(err); }
});

app.post('/v1/settlement', async (req, res, next) => {
  try {
    const marketId = Number(req.body.marketId);
    const [market, report, payouts, pool] = await Promise.all([
      read('get_market', [marketId]), read('get_resolution_report', [marketId]),
      read('get_base_payouts', [marketId]), escrow.pools(marketId),
    ]);
    assertCanonicalSettlement({ marketId, market, report, payouts, pool });
    const recipients = payouts.map((row) => getAddress(row.address));
    const amounts = payouts.map((row) => BigInt(row.amount));
    const verdictHash = keccak256(toUtf8Bytes(canonicalJson(report)));
    const settlementId = keccak256(AbiCoder.defaultAbiCoder().encode(['address','uint256','bytes32'], [cfg.genLayerContract, marketId, verdictHash]));
    const payoutsHash = keccak256(AbiCoder.defaultAbiCoder().encode(['address[]','uint256[]'], [recipients, amounts]));
    const { chainId, escrowAddress } = await context();
    const typeHash = keccak256(toUtf8Bytes('EventWeaverSettlement(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 settlementId,bytes32 payoutsHash,bytes32 verdictHash,uint256 deposited)'));
    const signature = await signInner(
      ['bytes32','uint256','address','address','uint256','bytes32','bytes32','bytes32','uint256'],
      [typeHash, chainId, escrowAddress, cfg.genLayerContract, marketId, settlementId, payoutsHash, verdictHash, pool.deposited]
    );
    res.json({ marketId, settlementId, recipients, amounts: amounts.map(String), verdictHash, signature });
  } catch (err) { next(err); }
});

app.use((err, _req, res, _next) => res.status(422).json({ error: err.message }));
// Fly's private `.internal` service discovery resolves to machine IPv6.
// The unspecified IPv6 address accepts both private IPv6 and proxied IPv4.
app.listen(cfg.port, '::');
