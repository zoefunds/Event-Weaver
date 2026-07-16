import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PlatformStats } from '../lib/types';
import { formatGen } from '../lib/wallet';

/** Landing — hero with animated causal chain, explainer, features, CTA. */
export default function Landing() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <main className="pt-16">
      {/* Hero */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-5 text-center md:px-16">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative z-10 mx-auto max-w-4xl">
          <span className="label-caps mb-4 block tracking-widest text-tertiary opacity-90">
            Next-gen prediction infrastructure
          </span>
          <h1
            className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Predict the <span className="text-primary">Chain Reaction.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-on-variant">
            Architect probabilities beyond binary outcomes. Build, stake, and settle trustless
            causal chains — adjudicated against live web evidence by GenLayer validator consensus.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/markets"
              className="label-caps flex items-center gap-3 rounded-lg bg-primary-deep px-8 py-4 text-white transition-all hover:shadow-[0_0_20px_rgba(77,142,255,0.4)]"
            >
              Explore Markets →
            </Link>
            <Link
              to="/create"
              className="label-caps rounded-lg border border-outline px-8 py-4 text-on-surface transition-all hover:bg-white/5"
            >
              Build a Chain
            </Link>
          </div>
        </div>

        {/* Causal chain visualization */}
        <div className="relative z-10 mt-20 w-full max-w-5xl">
          <div className="glass relative flex items-center justify-between rounded-xl px-8 py-12">
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
              viewBox="0 0 1000 200"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="hero-grad" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#4d8eff" />
                  <stop offset="100%" stopColor="#571bc1" />
                </linearGradient>
              </defs>
              <path className="dash-flow" d="M180 100 L400 100" stroke="url(#hero-grad)" strokeWidth="2" fill="none" />
              <path className="dash-flow" d="M540 100 L760 100" stroke="url(#hero-grad)" strokeWidth="2" fill="none" />
            </svg>
            <HeroNode label="Event A" sub="Trigger" color="text-primary" icon="◈" />
            <HeroNode label="Condition B" sub="Dependent" color="text-secondary" icon="⬡" big />
            <div className="flex flex-col items-center gap-4">
              <div className="genlayer-gradient flex items-center gap-3 rounded-full px-6 py-3 shadow-lg">
                <span className="text-white">✓</span>
                <span className="label-caps text-white">Resolved by GenLayer</span>
              </div>
              <div className="text-center">
                <span className="label-caps block text-tertiary">Outcome C</span>
                <span className="text-[10px] uppercase text-outline" style={{ fontFamily: 'var(--font-mono)' }}>
                  Settled
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live stats strip */}
      {stats && (
        <section className="border-y border-white/5 bg-[#0e0e0f] px-5 py-8 md:px-16">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
            <Stat label="Markets woven" value={String(stats.market_count ?? 0)} />
            <Stat label="Total staked" value={`${formatGen(stats.total_volume ?? 0, 2)} GEN`} />
            <Stat label="Stake actions" value={String(stats.total_stakes ?? 0)} />
            <Stat label="Chains resolved" value={String(stats.total_resolved ?? 0)} />
          </div>
        </section>
      )}

      {/* Explainer */}
      <section className="bg-[#0e0e0f] px-5 py-28 md:px-16">
        <div className="mx-auto grid max-w-7xl items-center gap-14 md:grid-cols-2">
          <div>
            <h2 className="mb-6 text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Beyond <span className="text-secondary">Binary Bets</span>
            </h2>
            <p className="mb-10 max-w-lg leading-relaxed text-on-variant">
              Traditional prediction markets stop at "Yes/No". EventWeaver models real-world
              complexity where outcome C depends on catalyst B, which depends on trigger A — and
              the whole chain must occur, in order, for the market to resolve YES.
            </p>
            <div className="space-y-5">
              <Feature
                icon="⛓"
                title="Ordered dependencies"
                text="Chains of 2–12 verifiable conditions, each with its own public evidence sources."
                tint="text-primary bg-primary/10"
              />
              <Feature
                icon="⚖"
                title="Trustless adjudication"
                text="GenLayer validators independently fetch evidence and reason over it with LLMs; consensus accepts only semantically-equivalent verdicts."
                tint="text-tertiary bg-tertiary/10"
              />
              <Feature
                icon="↯"
                title="Real value transfer"
                text="Stakes are native token transfers into the contract; winnings flow back out on-chain when you withdraw."
                tint="text-secondary bg-secondary/10"
              />
            </div>
          </div>
          <div className="glass rounded-3xl p-8">
            <div className="label-caps mb-4 text-outline">Example chain</div>
            <div
              className="space-y-3 rounded-lg bg-black/40 p-5 text-sm leading-relaxed"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              <div>
                <span className="text-tertiary">IF</span>{' '}
                <span className="text-on-surface">Apple launches AR glasses before June</span>
              </div>
              <div>
                <span className="text-tertiary">THEN</span>{' '}
                <span className="text-on-surface">Meta delays Orion</span>
              </div>
              <div>
                <span className="text-tertiary">THEN</span>{' '}
                <span className="text-on-surface">Qualcomm +10% within 30 days</span>
              </div>
              <div className="border-t border-white/10 pt-3 text-primary">
                → market resolves YES only if the entire chain occurs
              </div>
            </div>
            <div className="mt-6 space-y-2 text-[12px] text-tertiary/70" style={{ fontFamily: 'var(--font-mono)' }}>
              <div>&gt; EVIDENCE: apple.com/newsroom → FETCHED</div>
              <div>&gt; LLM VERDICT: occurred=true conf=90</div>
              <div>&gt; CONSENSUS: MAJORITY_AGREE</div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section className="px-5 py-28 md:px-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Built for Architects of <span className="text-primary">Probability</span>
          </h2>
          <p className="mb-14 text-on-variant">
            Precision tooling for logic-based prediction ecosystems.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="glass glass-hover rounded-2xl p-9 md:col-span-2">
              <h3 className="mb-3 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Evidence-grounded resolution
              </h3>
              <p className="max-w-md text-on-variant">
                The Intelligent Contract fetches your market's declared sources at resolution time
                — news, filings, official announcements — and reasons over the actual content. No
                oracle middlemen, no committee votes on vibes.
              </p>
              <div className="mt-8 flex gap-3">
                <span className="label-caps rounded bg-surface-high px-3 py-1 text-primary">GenLayer powered</span>
                <span className="label-caps rounded bg-surface-high px-3 py-1 text-tertiary">Web-native oracles</span>
              </div>
            </div>
            <div className="glass glass-hover rounded-2xl p-9">
              <h3 className="mb-3 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Chain builder
              </h3>
              <p className="text-on-variant">
                Compose triggers and dependent outcomes step by step, attach evidence URLs, set a
                confidence floor, deploy.
              </p>
            </div>
            <div className="glass glass-hover rounded-2xl p-9">
              <h3 className="mb-3 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Transparent reasoning
              </h3>
              <p className="text-on-variant">
                Every step stores the validators' reasoning and evidence summary on-chain — audit
                any verdict, any time.
              </p>
            </div>
            <div className="glass glass-hover rounded-2xl p-9 md:col-span-2">
              <h3 className="mb-3 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                Pro-rata settlement
              </h3>
              <p className="max-w-lg text-on-variant">
                Winners split the losing pool proportionally to their stake. Claim credits your
                on-chain balance; withdraw emits a real native transfer to your wallet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 text-center md:px-16">
        <div className="glass relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] border-primary/20 p-14">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5" />
          <h2 className="mb-8 text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Ready to weave your first chain?
          </h2>
          <div className="flex flex-col justify-center gap-5 sm:flex-row">
            <Link
              to="/create"
              className="label-caps rounded-full bg-primary px-10 py-4 text-on-primary transition-all hover:bg-primary/90"
            >
              Launch the builder
            </Link>
            <Link
              to="/markets"
              className="label-caps rounded-full border border-white/10 bg-surface-highest px-10 py-4 text-on-surface transition-all hover:bg-surface-high"
            >
              Browse live markets
            </Link>
          </div>
          <p className="mt-10 text-sm text-outline" style={{ fontFamily: 'var(--font-mono)' }}>
            Live on GenLayer StudioNet · secured by Optimistic Democracy
          </p>
        </div>
      </section>
    </main>
  );
}

function HeroNode({
  label, sub, color, icon, big,
}: { label: string; sub: string; color: string; icon: string; big?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${big ? 'translate-y-3' : ''}`}>
      <div
        className={`hex-node flex items-center justify-center border border-white/10 bg-surface-high ${big ? 'h-20 w-20' : 'h-16 w-16'}`}
      >
        <span className={`${color} text-2xl`}>{icon}</span>
      </div>
      <div className="text-center">
        <span className="label-caps block text-on-surface">{label}</span>
        <span className="text-[10px] uppercase text-outline" style={{ fontFamily: 'var(--font-mono)' }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

function Feature({ icon, title, text, tint }: { icon: string; title: string; text: string; tint: string }) {
  return (
    <div className="glass glass-hover flex items-start gap-4 rounded-lg p-6">
      <span className={`rounded p-2 text-xl ${tint}`}>{icon}</span>
      <div>
        <h4 className="font-bold text-on-surface">{title}</h4>
        <p className="mt-1 text-sm text-on-variant">{text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      <div className="label-caps mt-1 text-outline">{label}</div>
    </div>
  );
}
