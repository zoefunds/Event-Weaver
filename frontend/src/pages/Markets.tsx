import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Market } from '../lib/types';
import { MarketCard } from '../components/MarketCard';

const STATUS_FILTERS = ['ALL', 'OPEN', 'RESOLVING', 'RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED'];

/** Discovery — filterable grid of live markets. */
export default function Markets() {
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState<'newest' | 'volume'>('newest');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    api.config().then((c) => setCategories(c.categories ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    setMarkets(null);
    api
      .markets({ limit: 100 })
      .then(setMarkets)
      .catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    let rows = markets ?? [];
    if (status !== 'ALL') rows = rows.filter((m) => m.status === status);
    if (category !== 'ALL') rows = rows.filter((m) => m.category === category);
    if (sort === 'volume') rows = [...rows].sort((a, b) => b.total_pool - a.total_pool);
    return rows;
  }, [markets, status, category, sort]);

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-12 pt-24 md:px-16">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Active Markets
          </h1>
          <p className="mt-2 text-lg text-on-variant">
            Discover causal logic chains across global events.
          </p>
        </div>
        <div className="flex rounded-lg bg-surface-highest p-1">
          <button
            onClick={() => setSort('newest')}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${sort === 'newest' ? 'bg-surface-high font-bold text-on-surface' : 'text-on-variant hover:text-on-surface'}`}
          >
            Newest
          </button>
          <button
            onClick={() => setSort('volume')}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${sort === 'volume' ? 'bg-surface-high font-bold text-on-surface' : 'text-on-variant hover:text-on-surface'}`}
          >
            High Volume
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Filters */}
        <aside className="col-span-12 space-y-8 lg:sticky lg:top-24 lg:col-span-3 lg:h-fit">
          <div>
            <h3 className="label-caps mb-4 text-on-variant">Status</h3>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    status === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface-low text-on-variant hover:border-primary/50'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="label-caps mb-4 text-on-variant">Category</h3>
            <div className="flex flex-wrap gap-2 lg:flex-col">
              {['ALL', ...categories].map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    category === c
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant bg-surface-low text-on-variant hover:border-primary/50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <section className="col-span-12 lg:col-span-9">
          {error && (
            <div className="glass rounded-xl border-error/40 p-8 text-error">
              Failed to load markets: {error}
            </div>
          )}
          {!markets && !error && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="glass h-72 animate-pulse rounded-xl" />
              ))}
            </div>
          )}
          {markets && visible.length === 0 && (
            <div className="glass flex flex-col items-center gap-4 rounded-xl p-16 text-center">
              <span className="text-4xl">🕸</span>
              <h3 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                No markets match these filters
              </h3>
              <p className="text-on-variant">Be the first to weave a chain in this space.</p>
              <a href="/create" className="rounded-lg bg-primary px-6 py-3 font-bold text-on-primary">
                Create a market
              </a>
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {visible.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
