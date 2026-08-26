/** Base Sepolia USDC payment rail. No provider SDK: transactions are encoded
 * locally and signed by the user's injected EIP-1193 wallet. */
export const BASE_SEPOLIA_CHAIN_ID = '0x14a34';
export const USDC_ADDRESS = (import.meta.env.VITE_BASE_SEPOLIA_USDC ??
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`;
export const ESCROW_ADDRESS = (import.meta.env.VITE_BASE_ESCROW_ADDRESS ?? '') as `0x${string}`;
export const USDC = 10n ** 6n;

interface Provider { request(args: { method: string; params?: unknown[] }): Promise<unknown>; }

function provider(): Provider {
  if (!window.ethereum) throw new Error('Install an EIP-1193 wallet such as MetaMask.');
  return window.ethereum as Provider;
}

async function ensureBaseSepolia() {
  const eth = provider();
  if ((await eth.request({ method: 'eth_chainId' }) as string).toLowerCase() === BASE_SEPOLIA_CHAIN_ID) return;
  try { await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }] }); }
  catch {
    await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: BASE_SEPOLIA_CHAIN_ID, chainName: 'Base Sepolia', nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://sepolia.base.org'], blockExplorerUrls: ['https://sepolia.basescan.org'] }] });
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }] });
  }
}

function word(value: bigint | string): string {
  const hex = typeof value === 'bigint' ? value.toString(16) : value.replace(/^0x/, '');
  return hex.padStart(64, '0');
}
function addressWord(address: string) { return word(address); }
function calldata(selector: string, values: (bigint | string)[]) { return selector + values.map(word).join(''); }

async function send(to: string, data: string, gas = '0x30d40') {
  const eth = provider();
  const accounts = await eth.request({ method: 'eth_accounts' }) as string[];
  if (!accounts?.[0]) throw new Error('Connect your wallet first.');
  // Avoid provider over-estimation above Base Sepolia's per-transaction cap.
  return eth.request({ method: 'eth_sendTransaction', params: [{ from: accounts[0], to, data, value: '0x0', gas }] }) as Promise<string>;
}

async function waitForConfirmation(hash: string): Promise<void> {
  const eth = provider();
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const receipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [hash] }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error('Base Sepolia transaction reverted.');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Timed out waiting for Base Sepolia confirmation.');
}

/** Approve and deposit USDC. The caller then records the identical amount on
 * GenLayer, keeping outcome logic and custody on their appropriate chains. */
export async function depositStakeUsdc(marketId: number, amount: bigint) {
  if (!ESCROW_ADDRESS || !/^0x[0-9a-fA-F]{40}$/.test(ESCROW_ADDRESS)) throw new Error('Base escrow is not configured yet.');
  if (amount <= 0n) throw new Error('Enter a positive USDC amount.');
  await ensureBaseSepolia();
  const approvalTx = await send(USDC_ADDRESS, calldata('0x095ea7b3', [addressWord(ESCROW_ADDRESS), amount]), '0x186a0');
  await waitForConfirmation(approvalTx);
  const stakeTx = await send(ESCROW_ADDRESS, calldata('0x7b0472f0', [BigInt(marketId), amount]), '0x30d40');
  await waitForConfirmation(stakeTx);
  return stakeTx;
}

export async function claimUsdc(marketId: number) {
  if (!ESCROW_ADDRESS || !/^0x[0-9a-fA-F]{40}$/.test(ESCROW_ADDRESS)) throw new Error('Base escrow is not configured yet.');
  await ensureBaseSepolia();
  const txHash = await send(ESCROW_ADDRESS, calldata('0x379607f5', [BigInt(marketId)]), '0x249f0');
  await waitForConfirmation(txHash);
  return txHash;
}

export function formatUsdc(unitsRaw: number | string | bigint, digits = 2) {
  const units = BigInt(typeof unitsRaw === 'number' ? Math.trunc(unitsRaw) : unitsRaw || 0);
  const whole = units / USDC;
  const fraction = (units % USDC).toString().padStart(6, '0').slice(0, digits).replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

export function parseUsdc(amount: string) {
  if (!/^\d*(?:\.\d{0,6})?$/.test(amount.trim())) throw new Error('Enter a USDC amount with up to 6 decimals.');
  const [whole = '0', fraction = ''] = amount.trim().split('.');
  return BigInt(whole || '0') * USDC + BigInt((fraction + '000000').slice(0, 6));
}
