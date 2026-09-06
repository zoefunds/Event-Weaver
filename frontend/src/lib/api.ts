import type { Market, Portfolio, PlatformStats, ActivityEvent } from './types';

/** REST client for the EventWeaver indexer API (Fly.io). */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(`API ${status}: ${path}`);
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json() as Promise<T>;
}

export const api = {
  markets: (params: { status?: string; category?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.category) q.set('category', params.category);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return get<Market[]>(`/api/markets${qs ? `?${qs}` : ''}`);
  },
  market: (id: number) => get<Market>(`/api/markets/${id}`),
  marketLive: (id: number) => get<Market>(`/api/markets/${id}/live`),
  activity: (id: number) => get<ActivityEvent[]>(`/api/markets/${id}/activity`),
  resolution: (id: number) => get<Record<string, unknown>>(`/api/markets/${id}/resolution`),
  portfolio: (address: string) => get<Portfolio>(`/api/portfolio/${address}`),
  stats: () => get<PlatformStats>('/api/stats'),
  config: () =>
    get<{ contractAddress: string; categories: string[]; chainConfig: Record<string, unknown> }>(
      '/api/config'
    ),
  /** Status of one confirmed USDC deposit as the backend relayer turns it
   * into a GenLayer position. 404 means it hasn't cleared confirmations yet. */
  stakeStatus: (txHash: string) =>
    get<{ status: string; attempts?: number; lastError?: string | null }>(`/api/stakes/${txHash}`),
  /** Every confirmed deposit for an address and where it stands in the
   * relay — lets the UI show a stake that hasn't reached 'applied' yet
   * (e.g. the user navigated away mid-poll) instead of it disappearing. */
  stakes: (address: string) =>
    get<
      { baseTxHash: string; marketId: number; side: number; amount: string; status: string; attempts: number; lastError: string | null }[]
    >(`/api/stakes?address=${address}`),
};
