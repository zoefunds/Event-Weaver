import type { MarketStatus, StepState } from '../lib/types';

/** Status chips — label-caps, 15% tinted backgrounds per DESIGN.md. */

const statusStyles: Record<MarketStatus, string> = {
  OPEN: 'bg-primary/15 text-primary',
  RESOLVING: 'bg-amber/15 text-amber',
  RESOLVED_YES: 'bg-tertiary/15 text-tertiary',
  RESOLVED_NO: 'bg-error/15 text-error',
  CANCELLED: 'bg-outline/15 text-outline',
  EXPIRED: 'bg-error/15 text-error',
};

export function StatusChip({ status }: { status: MarketStatus }) {
  return (
    <span className={`label-caps rounded px-2 py-1 ${statusStyles[status] ?? statusStyles.OPEN}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

const stepStyles: Record<StepState, string> = {
  PENDING: 'bg-primary/15 text-primary',
  FULFILLED: 'bg-tertiary/15 text-tertiary',
  FAILED: 'bg-error/15 text-error',
};

export function StepChip({ state }: { state: StepState }) {
  return (
    <span className={`label-caps rounded px-2 py-0.5 ${stepStyles[state]}`}>{state}</span>
  );
}

export function CategoryChip({ category }: { category: string }) {
  return (
    <span className="label-caps rounded bg-secondary/15 px-2 py-1 text-secondary">{category}</span>
  );
}
