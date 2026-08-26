import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Portfolio as PortfolioData } from '../lib/types';
import { useWallet } from '../lib/wallet';
import { claimUsdc, formatUsdc } from '../lib/baseSepolia';
import { StatusChip } from '../components/Chips';
import { useToast } from '../components/Toast';

export default function Portfolio() {
  const { address, connect } = useWallet();
  const { push } = useToast();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try { setData(await api.portfolio(address)); } catch { push('error', 'Could not load portfolio.'); }
    finally { setLoading(false); }
  }, [address, push]);
  useEffect(() => { refresh(); }, [refresh]);
  const claim = async (marketId: number) => {
    setBusy(`claim-${marketId}`);
    try {
      await claimUsdc(marketId);
      await refresh();
      push('success', 'USDC claim confirmed on Base Sepolia.');
    }
    catch (e) { push('error', (e as Error).message.slice(0, 140)); }
    finally { setBusy(''); }
  };
  if (!address) return <main className="mx-auto max-w-3xl px-5 pt-40 text-center"><div className="glass rounded-xl p-14"><h1 className="mb-4 text-3xl font-bold">Your Portfolio</h1><p className="mb-8 text-on-variant">Connect a wallet to see your USDC positions and claims.</p><button onClick={connect} className="rounded-lg bg-primary px-8 py-3 font-bold text-on-primary">Connect Wallet</button></div></main>;
  return <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-16 pt-24 md:px-16"><header className="mb-10"><h1 className="text-4xl font-bold tracking-tight">Portfolio</h1><p className="mt-2 text-on-variant" style={{ fontFamily: 'var(--font-mono)' }}>{address}</p></header><div className="grid grid-cols-12 gap-6"><section className="col-span-12 space-y-4 lg:col-span-8"><h3 className="label-caps text-on-variant">USDC positions</h3>{loading && <div className="glass h-40 animate-pulse rounded-xl" />}{!loading && data?.positions.length === 0 && <div className="glass rounded-xl p-14 text-center text-on-variant">No positions yet — <Link to="/markets" className="text-primary">explore markets</Link>.</div>}{data?.positions.map((p) => { const claimable = BigInt(p.quote?.claimable ?? 0); return <div key={p.market_id} className="glass rounded-xl p-6"><div className="mb-3 flex justify-between gap-3"><Link to={`/market/${p.market_id}`} className="text-lg font-semibold">{p.market?.title ?? `Market #${p.market_id}`}</Link>{p.market && <StatusChip status={p.market.status} />}</div><div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4"><Cell k="YES stake" v={`${formatUsdc(p.position.yes_amount, 3)} USDC`} /><Cell k="NO stake" v={`${formatUsdc(p.position.no_amount, 3)} USDC`} /><Cell k="If YES wins" v={`${formatUsdc(p.quote?.hypothetical_yes_win ?? 0, 3)} USDC`} />{claimable > 0n && <button onClick={() => claim(p.market_id)} disabled={!!busy} className="rounded-lg bg-tertiary px-4 py-2 font-bold text-on-tertiary">{busy === `claim-${p.market_id}` ? 'Claiming…' : `Claim ${formatUsdc(claimable, 3)} USDC`}</button>}</div></div>; })}</section><aside className="col-span-12 lg:col-span-4"><div className="glass rounded-xl border-primary/20 p-6"><h3 className="label-caps mb-4 text-on-variant">Base Sepolia settlement</h3><p className="text-sm leading-relaxed text-on-variant">After GenLayer finalizes a market, the relayer credits the USDC payout in EventWeaver escrow. Claims go directly from the escrow contract to your wallet.</p></div></aside></div></main>;
}
function Cell({ k, v }: { k: string; v: string }) { return <div><div className="label-caps text-outline">{k}</div><div className="font-bold">{v}</div></div>; }
