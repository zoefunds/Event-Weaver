/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import type { GenLayerClient } from 'genlayer-js/types';

/**
 * Wallet context — MetaMask (or any injected EIP-1193 wallet) connected to
 * GenLayer StudioNet through genlayer-js. Passing the injected account
 * address to createClient makes genlayer-js sign via the injected provider.
 */

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ??
  '0xb28225714cb7C087d30F3168d241d094Bcd8a03A') as `0x${string}`;

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, cb: (accounts: string[]) => void): void;
  removeListener(event: string, cb: (accounts: string[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

interface WalletState {
  address: `0x${string}` | null;
  client: GenLayerClient<typeof studionet> | null;
  connecting: boolean;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Read-only client that always works, wallet or not. */
  readClient: GenLayerClient<typeof studionet>;
}

const WalletContext = createContext<WalletState | null>(null);

const readClient = createClient({ chain: studionet });

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | null>(
    () => (localStorage.getItem('ew:address') as `0x${string}`) || null
  );
  const [connecting, setConnecting] = useState(false);

  const client = useMemo(() => {
    if (!address || !window.ethereum) return null;
    return createClient({ chain: studionet, account: address });
  }, [address]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];
      if (accounts[0]) {
        setAddress(accounts[0] as `0x${string}`);
        localStorage.setItem('ew:address', accounts[0]);
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    localStorage.removeItem('ew:address');
  }, []);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const onAccounts = (accounts: string[]) => {
      if (!accounts.length) disconnect();
      else {
        setAddress(accounts[0] as `0x${string}`);
        localStorage.setItem('ew:address', accounts[0]);
      }
    };
    eth.on('accountsChanged', onAccounts);
    return () => eth.removeListener('accountsChanged', onAccounts);
  }, [disconnect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        client,
        connecting,
        hasWallet: typeof window !== 'undefined' && !!window.ethereum,
        connect,
        disconnect,
        readClient,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet outside WalletProvider');
  return ctx;
}

/** Native units per GEN (wei-scale). */
export const GEN = 10n ** 18n;

export function formatGen(unitsRaw: number | string | bigint, digits = 4): string {
  const units = BigInt(typeof unitsRaw === 'number' ? Math.trunc(unitsRaw) : unitsRaw || 0);
  const whole = units / GEN;
  const frac = units % GEN;
  const fracStr = (Number(frac) / 1e18).toFixed(digits).slice(2);
  return `${whole}${Number(fracStr) > 0 || fracStr.match(/[1-9]/) ? '.' + fracStr : ''}`;
}

export function parseGen(amount: string): bigint {
  const [whole = '0', frac = ''] = amount.split('.');
  const fracPadded = (frac + '0'.repeat(18)).slice(0, 18);
  return BigInt(whole || '0') * GEN + BigInt(fracPadded || '0');
}

export function shortAddr(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

/** Contract write helper: submits and waits for ACCEPTED. */
export async function contractWrite(
  client: GenLayerClient<typeof studionet>,
  functionName: string,
  args: unknown[],
  value?: bigint
): Promise<unknown> {
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    // genlayer-js encodes primitives/arrays/objects as GenLayer calldata
    args: args as never[],
    value: value ?? 0n,
  });
  return client.waitForTransactionReceipt({
    hash,
    status: 'ACCEPTED' as never,
    interval: 3000,
    retries: 60,
  });
}

export function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}
