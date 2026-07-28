import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Market, ChainStep, ActivityEvent, Position } from '../lib/types';
import { StatusChip, StepChip, CategoryChip } from '../components/Chips';
import { useWallet, contractWrite, formatGen, parseGen } from '../lib/wallet';
import { useToast } from '../components/Toast';

/** Market detail — the Causal Chain View: nodes, reasoning, trading panel. */
export default function MarketDetail() {
  const { id } = useParams();
  const marketId = Number(id);
  const { address, client, connect, readClient } = useWallet();
  const { push } = useToast();

  const [market, setMarket] = useState<Market | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [amount, setAmount] = useState('0.1');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const m = await api.marketLive(marketId).catch(() => api.market(marketId));
      setMarket(m);
      api.activity(marketId).then(setActivity).catch(() => {});
      if (address) {
        try {
          const pos = (await readClient.readContract({
            address: (import.meta.env.VITE_CONTRACT_ADDRESS ??
              '0x0361b5a160637407e7D93Ff8C1CC866855dD0cc2') as `0x${string}`,
            functionName: 'get_position',
            args: [marketId, address],
          })) as unknown;
          setPosition(plainPos(pos));
        } catch { /* ignore */ }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [marketId, address, readClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (label: string, fn: () => Promise<unknown>, success: string) => {
    if (!client) return connect();
    setBusy(label);
    try {
      await fn();
      push('success', success);
      await refresh();
    } catch (e) {
      push('error', friendlyError(e));
    } finally {
      setBusy('');
    }
  };

  const stake = (side: 'yes' | 'no') =>
    act(
      `stake_${side}`,
      () => contractWrite(client!, side === 'yes' ? 'stake_yes' : 'stake_no', [marketId], parseGen(amount)),
      `Staked ${amount} GEN on ${side.toUpperCase()} — value transferred on-chain.`
    );

  const requestResolution = () =>
    act(
      'resolve',
      () => contractWrite(client!, 'request_resolution', [marketId]),
      'Adjudication pass submitted — validators are fetching evidence.'
    );

  const claim = () =>
    act(
      'claim',
      () => contractWrite(client!, 'claim', [marketId]),
      'Winnings claimed to your balance. Withdraw from Portfolio to move tokens to your wallet.'
    );

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-32 text-center">
        <div className="glass rounded-xl border-error/40 p-10 text-error">Market not found. {error}</div>
      </main>
    );
  }
  if (!market) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 pt-24 md:px-16">
        <div className="glass h-96 animate-pulse rounded-xl" />
      </main>
    );
  }

  const prob = (market.implied_yes_bps / 100).toFixed(1);
  const steps: ChainStep[] = market.steps ?? [];
  const isTerminal = ['RESOLVED_YES', 'RESOLVED_NO', 'EXPIRED', 'CANCELLED'].includes(market.status);
  const winningSide =
    market.status === 'RESOLVED_YES' ? 'yes' : market.status === 'RESOLVED_NO' || market.status === 'EXPIRED' ? 'no' : null;
  const canClaim =
    position && !position.claimed && winningSide &&
    ((winningSide === 'yes' && position.yes_amount > 0) || (winningSide === 'no' && position.no_amount > 0));
  const deadlinePassed = Date.now() / 1000 > market.deadline_ts;
  // Contract policy: pre-deadline adjudication is creator-only; post-deadline
  // it is permissionless (and the backend auto-triggers it anyway).
  const canAdjudicate =
    deadlinePassed || (address != null && address.toLowerCase() === market.creator.toLowerCase());

  return (
    <main className="mx-auto max-w-[1440px] px-5 pb-16 pt-24 md:px-16">
      <header className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <StatusChip status={market.status} />
          <CategoryChip category={market.category} />
          <span className="text-sm text-on-variant" style={{ fontFamily: 'var(--font-mono)' }}>
            ID: EW-{String(market.id).padStart(4, '0')}
          </span>
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {market.title}
        </h1>
        <p className="max-w-3xl text-lg text-on-variant">{market.description}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* LEFT — chain + reasoning */}
        <section className="col-span-12 space-y-6 lg:col-span-8">
          <div className="glass grid-bg relative rounded-xl p-8">
            <h3 className="label-caps mb-8 text-on-variant">Causal chain</h3>
            <div className="space-y-6">
              {steps.map((step, i) => (
                <StepCard key={i} step={step} last={i === steps.length - 1} />
              ))}
            </div>
            <div className="mt-10 flex flex-wrap justify-center gap-6 border-t border-white/5 pt-6">
              <Legend color="bg-tertiary" label="Verified by GenLayer" />
              <Legend color="bg-primary" label="Pending evidence" />
              <Legend color="bg-error" label="Failed / broken chain" />
            </div>
          </div>

          {market.resolution_summary && (
            <div className="glass rounded-xl border-l-4 border-l-primary p-6">
              <h3 className="mb-3 text-xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
                GenLayer Resolution
              </h3>
              <p className="leading-relaxed text-on-variant">{market.resolution_summary}</p>
            </div>
          )}

          {/* Activity feed */}
          <div className="glass rounded-xl p-6">
            <h3 className="label-caps mb-4 text-on-variant">Activity feed</h3>
            {activity.length === 0 && <p className="text-sm text-outline">No activity yet.</p>}
            <div className="custom-scroll max-h-80 space-y-3 overflow-y-auto pr-2">
              {activity.map((a, i) => (
                <div key={i} className="rounded border border-white/5 bg-surface-low p-3">
                  <div className="mb-1 flex justify-between">
                    <span className="label-caps text-tertiary">{a.kind.replace('_', ' ')}</span>
                    <span className="text-[10px] text-on-variant" style={{ fontFamily: 'var(--font-mono)' }}>
                      {new Date(Number(a.ts) * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface" style={{ fontFamily: 'var(--font-mono)' }}>
                    {a.actor.slice(0, 10)}… {Number(a.amount) > 0 && `· ${formatGen(a.amount, 3)} GEN`} {a.note && `· ${a.note}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT — trading panel */}
        <aside className="col-span-12 space-y-6 lg:col-span-4">
          <div className="glass rounded-xl border-primary/20 p-6">
            <h3 className="mb-6 flex items-center justify-between text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Stake on the chain
              <span className="text-2xl font-bold text-tertiary">{prob}%</span>
            </h3>

            <div className="mb-6 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-lg border border-tertiary/40 bg-tertiary/10 p-3">
                <div className="label-caps text-tertiary">Yes pool</div>
                <div className="font-bold text-tertiary">{formatGen(market.yes_pool, 2)} GEN</div>
              </div>
              <div className="rounded-lg border border-error/40 bg-error/10 p-3">
                <div className="label-caps text-error">No pool</div>
                <div className="font-bold text-error">{formatGen(market.no_pool, 2)} GEN</div>
              </div>
            </div>

            {market.status === 'OPEN' && (
              <>
                <label className="label-caps mb-2 block text-on-variant">Amount (GEN)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="mb-4 w-full rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-on-surface outline-none focus:border-primary"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => stake('yes')}
                    disabled={!!busy}
                    className="rounded-lg border border-tertiary bg-tertiary/10 py-3 font-bold text-tertiary transition-all hover:bg-tertiary/20 active:scale-95 disabled:opacity-50"
                  >
                    {busy === 'stake_yes' ? 'Staking…' : 'STAKE YES'}
                  </button>
                  <button
                    onClick={() => stake('no')}
                    disabled={!!busy}
                    className="rounded-lg border border-error bg-error/10 py-3 font-bold text-error transition-all hover:bg-error/20 active:scale-95 disabled:opacity-50"
                  >
                    {busy === 'stake_no' ? 'Staking…' : 'STAKE NO'}
                  </button>
                </div>
                {!address && (
                  <p className="mt-3 text-center text-xs text-outline">Connect your wallet to stake.</p>
                )}
              </>
            )}

            {!isTerminal && canAdjudicate && (
              <button
                onClick={requestResolution}
                disabled={!!busy}
                className="mt-4 w-full rounded-xl bg-primary py-4 font-bold text-on-primary shadow-[0_0_20px_rgba(173,198,255,0.2)] transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {busy === 'resolve' ? 'Validators adjudicating…' : 'REQUEST ADJUDICATION'}
              </button>
            )}
            {!isTerminal && !deadlinePassed && (
              <p className="mt-4 text-center text-[11px] leading-relaxed text-outline">
                {canAdjudicate
                  ? 'As the market creator you can verify steps early. '
                  : ''}
                Adjudication runs automatically once the deadline passes — GenLayer validators
                fetch the evidence and settle the chain.
              </p>
            )}

            {canClaim && (
              <button
                onClick={claim}
                disabled={!!busy}
                className="mt-4 w-full rounded-xl bg-tertiary py-4 font-bold text-on-tertiary transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {busy === 'claim' ? 'Claiming…' : 'CLAIM WINNINGS'}
              </button>
            )}

            {position && (position.yes_amount > 0 || position.no_amount > 0) && (
              <div className="mt-6 space-y-2 border-t border-white/5 pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-variant">Your YES stake</span>
                  <span className="text-tertiary">{formatGen(position.yes_amount, 3)} GEN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-variant">Your NO stake</span>
                  <span className="text-error">{formatGen(position.no_amount, 3)} GEN</span>
                </div>
                {position.claimed && <div className="label-caps text-outline">Claimed ✓</div>}
              </div>
            )}
          </div>

          <div className="glass rounded-xl p-6 text-sm">
            <h3 className="label-caps mb-4 text-on-variant">Market parameters</h3>
            <Row k="Creator" v={`${market.creator.slice(0, 10)}…`} mono />
            <Row k="Deadline" v={new Date(market.deadline_ts * 1000).toLocaleString()} />
            <Row k="Confidence floor" v={`${market.confidence_floor}%`} />
            <Row k="Steps" v={`${market.steps_fulfilled}/${market.step_count} fulfilled`} />
            <Row k="Stake actions" v={String(market.stake_count)} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function StepCard({ step, last }: { step: ChainStep; last: boolean }) {
  const border =
    step.state === 'FULFILLED' ? 'border-tertiary/50' : step.state === 'FAILED' ? 'border-error/50' : 'border-primary/30';
  return (
    <div className="flex flex-col items-center">
      <div className={`glass w-full rounded-xl border ${border} p-5`}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="label-caps text-outline">Step {step.index + 1}</span>
          <div className="flex items-center gap-2">
            {step.check_count > 0 && (
              <span className="text-[10px] text-outline" style={{ fontFamily: 'var(--font-mono)' }}>
                conf {step.confidence}% · {step.check_count} checks
              </span>
            )}
            <StepChip state={step.state} />
          </div>
        </div>
        <p className="font-medium text-on-surface">{step.description}</p>
        {step.reasoning && (
          <p className="mt-3 border-l-2 border-outline-variant pl-3 text-sm leading-relaxed text-on-variant">
            {step.reasoning}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {step.sources.map((s, i) => (
            <a
              key={i}
              href={s}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-black/40 px-2 py-1 text-[10px] text-primary hover:underline"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {new URL(s).hostname}
            </a>
          ))}
        </div>
      </div>
      {!last && <div className="logic-line my-1 h-8 w-[1.5px]" style={{ background: 'linear-gradient(180deg,#adc6ff,#4edea3)' }} />}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="label-caps text-[10px]">{label}</span>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between border-b border-white/5 py-2 last:border-0">
      <span className="text-on-variant">{k}</span>
      <span className="text-on-surface" style={mono ? { fontFamily: 'var(--font-mono)' } : undefined}>
        {v}
      </span>
    </div>
  );
}

function plainPos(raw: unknown): Position {
  const obj = raw instanceof Map ? Object.fromEntries(raw as Map<string, unknown>) : (raw as Record<string, unknown>);
  return {
    yes_amount: Number(obj?.yes_amount ?? 0),
    no_amount: Number(obj?.no_amount ?? 0),
    claimed: Boolean(obj?.claimed),
  };
}

function friendlyError(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e);
  if (msg.includes('EXPECTED:')) return msg.slice(msg.indexOf('EXPECTED:') + 10, msg.indexOf('EXPECTED:') + 140);
  if (msg.toLowerCase().includes('user rejected')) return 'Transaction rejected in wallet.';
  return msg.slice(0, 140);
}
