import type { Market, Portfolio, PlatformStats, ActivityEvent } from './types';

/** REST client for the EventWeaver indexer API (Fly.io). */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
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
};
