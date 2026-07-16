import type { ChainStep } from '../lib/types';

/** Horizontal causal-chain visualization: nodes joined by glowing lines. */

const stateColor: Record<string, string> = {
  FULFILLED: 'bg-tertiary',
  PENDING: 'bg-primary/50',
  FAILED: 'bg-error',
};

export function ChainViz({ steps, compact = false }: { steps: ChainStep[]; compact?: boolean }) {
  if (!steps.length) return null;
  return (
    <div className="relative w-full py-3">
      <div className="relative z-10 flex items-start justify-between gap-1">
        {steps.map((step, i) => (
          <StepNode key={i} step={step} compact={compact} last={i === steps.length - 1} />
        ))}
      </div>
    </div>
  );
}

function StepNode({ step, compact, last }: { step: ChainStep; compact: boolean; last: boolean }) {
  const color = stateColor[step.state] ?? 'bg-primary/50';
  const pulsing = step.state === 'PENDING' && step.check_count > 0;
  return (
    <>
      <div className="flex min-w-0 flex-col items-center gap-2">
        <div className={`h-3.5 w-3.5 rounded-full ${color} ${pulsing ? 'pulse-node' : ''}`} />
        {!compact && (
          <span
            className="max-w-[90px] text-center text-[10px] leading-tight text-outline"
            style={{ fontFamily: 'var(--font-mono)' }}
            title={step.description}
          >
            {truncate(step.description, 42)}
          </span>
        )}
      </div>
      {!last && <div className="logic-line mx-1 mt-1.5 flex-1" />}
    </>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
