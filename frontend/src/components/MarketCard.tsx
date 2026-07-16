import { Link } from 'react-router-dom';
import type { Market } from '../lib/types';
import { StatusChip, CategoryChip } from './Chips';
import { formatGen } from '../lib/wallet';

/** Discovery-grid market card with probability, pool, and chain badge. */
export function MarketCard({ market }: { market: Market }) {
  const prob = (market.implied_yes_bps / 100).toFixed(1);
  const deadline = new Date(market.deadline_ts * 1000);

  return (
    <Link
      to={`/market/${market.id}`}
      className="glass glass-hover group flex flex-col justify-between rounded-xl p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <CategoryChip category={market.category} />
          <span className="label-caps rounded bg-tertiary/15 px-2 py-1 text-tertiary">
            {market.step_count}-step chain
          </span>
          <StatusChip status={market.status} />
        </div>
        <div className="shrink-0 text-right">
          <div className="label-caps text-outline">Deadline</div>
          <div className="text-sm text-on-surface" style={{ fontFamily: 'var(--font-mono)' }}>
            {deadline.toLocaleDateString()}
          </div>
        </div>
      </div>

      <h2
        className="mb-4 text-xl font-semibold text-on-surface transition-colors group-hover:text-primary"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {market.title}
      </h2>

      {/* dot chain progress */}
      <div className="mb-5 flex items-center">
        {Array.from({ length: market.step_count }).map((_, i) => {
          const cls =
            i < market.steps_fulfilled
              ? 'bg-tertiary'
              : i < market.steps_fulfilled + market.steps_failed
                ? 'bg-error'
                : 'bg-primary/40';
          return (
            <span key={i} className="flex flex-1 items-center">
              <span className={`h-3 w-3 rounded-full ${cls}`} />
              {i < market.step_count - 1 && <span className="logic-line flex-1" />}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-5">
        <div>
          <div className="label-caps text-outline">Yes odds</div>
          <div
            className="text-2xl font-semibold text-tertiary"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {prob}%
          </div>
        </div>
        <div>
          <div className="label-caps text-outline">Pool</div>
          <div
            className="text-2xl font-semibold text-on-surface"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {formatGen(market.total_pool, 2)} <span className="text-sm text-outline">GEN</span>
          </div>
        </div>
        <div className="flex items-end justify-end">
          <span className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-transform group-hover:scale-105">
            Trade →
          </span>
        </div>
      </div>
    </Link>
  );
}
