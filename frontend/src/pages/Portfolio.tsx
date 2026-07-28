import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Portfolio as PortfolioData } from '../lib/types';
import { useWallet, contractWrite, formatGen, parseGen } from '../lib/wallet';
import { StatusChip } from '../components/Chips';
import { useToast } from '../components/Toast';

/** Portfolio — positions, claims, balance and the withdraw value path. */
export default function Portfolio() {
  const { address, client, connect } = useWallet();
  const { push } = useToast();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [busy, setBusy] = useState('');

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      setData(await api.portfolio(address));
    } catch {
      push('error', 'Could not load portfolio.');
    } finally {
      setLoading(false);
    }
  }, [address, push]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const claim = async (marketId: number) => {
    if (!client) return connect();
    setBusy(`claim-${marketId}`);
    try {
      await contractWrite(client, 'claim', [marketId]);
      push('success', 'Claimed — winnings credited to your withdrawable balance.');
      await refresh();
    } catch (e) {
      push('error', (e as Error).message.slice(0, 140));
    } finally {
      setBusy('');
    }
  };

  const withdraw = async () => {
    if (!client) return connect();
    const units = parseGen(withdrawAmt || '0');
    if (units <= 0n) return push('error', 'Enter a positive amount.');
    setBusy('withdraw');
    try {
      // Pass the BigInt itself — genlayer-js encodes big integers natively;
      // a string here reaches the contract as str and breaks the int compare.
      await contractWrite(client, 'withdraw', [units]);
      push('success', `Withdrawal submitted — ${withdrawAmt} GEN transfers to your wallet at finality.`);
      setWithdrawAmt('');
      await refresh();
    } catch (e) {
      push('error', (e as Error).message.slice(0, 140));
    } finally {
      setBusy('');
    }
  };

  if (!address) {
    return (
      <main className="mx-auto max-w-3xl px-5 pt-40 text-center">
        <div className="glass rounded-xl p-14">
          <h1 className="mb-4 text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Your Portfolio
          </h1>
          <p className="mb-8 text-on-variant">
            Connect a wallet to see your positions, claims, and balance.
          </p>
          <button
            onClick={connect}
            className="rounded-lg bg-primary px-8 py-3 font-bold text-on-primary transition-transform active:scale-95"
          >
            Connect Wallet
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-16 pt-24 md:px-16">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          Portfolio
        </h1>
        <p className="mt-2 text-on-variant" style={{ fontFamily: 'var(--font-mono)' }}>{address}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 space-y-4 lg:col-span-8">
          <h3 className="label-caps text-on-variant">Positions</h3>
          {loading && <div className="glass h-40 animate-pulse rounded-xl" />}
          {!loading && data && data.positions.length === 0 && (
            <div className="glass flex flex-col items-center gap-4 rounded-xl p-14 text-center">
              <span className="text-4xl">🧵</span>
              <p className="text-on-variant">No positions yet — stake on a chain to get started.</p>
              <Link to="/markets" className="rounded-lg bg-primary px-6 py-3 font-bold text-on-primary">
                Explore markets
              </Link>
            </div>
          )}
          {data?.positions.map((p) => {
            const claimable = Number(p.quote?.claimable ?? 0);
            return (
              <div key={p.market_id} className="glass glass-hover rounded-xl p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    to={`/market/${p.market_id}`}
                    className="text-lg font-semibold text-on-surface hover:text-primary"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {p.market?.title ?? `Market #${p.market_id}`}
                  </Link>
                  {p.market && <StatusChip status={p.market.status} />}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                  <Cell k="YES stake" v={`${formatGen(p.position.yes_amount, 3)} GEN`} tint="text-tertiary" />
                  <Cell k="NO stake" v={`${formatGen(p.position.no_amount, 3)} GEN`} tint="text-error" />
                  <Cell
                    k="If YES wins"
                    v={`${formatGen(p.quote?.hypothetical_yes_win ?? 0, 3)} GEN`}
                    tint="text-on-surface"
                  />
                  <div className="flex items-end justify-end">
                    {claimable > 0 && !p.position.claimed ? (
                      <button
                        onClick={() => claim(p.market_id)}
                        disabled={!!busy}
                        className="rounded-lg bg-tertiary px-5 py-2 font-bold text-on-tertiary transition-all active:scale-95 disabled:opacity-50"
                      >
                        {busy === `claim-${p.market_id}` ? 'Claiming…' : `Claim ${formatGen(claimable, 3)}`}
                      </button>
                    ) : p.position.claimed ? (
                      <span className="label-caps text-outline">Claimed ✓</span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Notifications */}
          <h3 className="label-caps pt-6 text-on-variant">Recent activity</h3>
          <div className="glass custom-scroll max-h-96 space-y-2 overflow-y-auto rounded-xl p-5">
            {data?.notifications?.length ? (
              data.notifications.map((n, i) => (
                <div key={i} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                  <span className="label-caps text-primary">{n.kind.replace('_', ' ')}</span>
                  <span className="text-on-variant" style={{ fontFamily: 'var(--font-mono)' }}>
                    {n.market_id !== undefined && `M#${n.market_id} · `}
                    {Number(n.amount) > 0 && `${formatGen(n.amount, 3)} GEN · `}
                    {new Date(Number(n.ts) * 1000).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-outline">Nothing yet.</p>
            )}
          </div>
        </section>

        {/* Balance + withdraw — the outbound value-transfer path */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="glass rounded-xl border-primary/20 p-6">
            <h3 className="label-caps mb-4 text-on-variant">Withdrawable balance</h3>
            <div className="mb-6 text-4xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
              {formatGen(data?.balance ?? 0, 4)} <span className="text-lg text-outline">GEN</span>
            </div>
            <label className="label-caps mb-2 block text-on-variant">Amount</label>
            <input
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="mb-4 w-full rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-on-surface outline-none focus:border-primary"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <button
              onClick={withdraw}
              disabled={!!busy}
              className="w-full rounded-xl bg-primary py-4 font-bold text-on-primary transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              {busy === 'withdraw' ? 'Submitting…' : 'WITHDRAW TO WALLET'}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-outline">
              Withdrawals emit a real native-token transfer from the EventWeaver contract to your
              address, settled when the transaction finalizes on GenLayer.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Cell({ k, v, tint }: { k: string; v: string; tint: string }) {
  return (
    <div>
      <div className="label-caps text-outline">{k}</div>
      <div className={`font-bold ${tint}`}>{v}</div>
    </div>
  );
}
