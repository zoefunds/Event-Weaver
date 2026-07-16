import { useEffect, useState } from 'react';
import { LogoMark } from './Logo';

/**
 * First-visit walkthrough — a guided 5-step tour of how EventWeaver works.
 * Shows once (localStorage flag), reopenable from the footer "Take the tour".
 */

const STEPS = [
  {
    icon: '⛓️',
    title: 'Markets are chains, not single bets',
    body: 'Every EventWeaver market is an ordered chain of real-world conditions — "if A happens, then B, then C". The market resolves YES only if the ENTIRE chain occurs, in order. One broken link and NO wins.',
    accent: 'text-primary',
  },
  {
    icon: '🦊',
    title: 'Connect your wallet',
    body: 'EventWeaver runs on GenLayer StudioNet. Connect MetaMask (or any injected wallet) with the "Connect Wallet" button — no signup, no passwords. Your address is your account.',
    accent: 'text-secondary',
  },
  {
    icon: '⚖️',
    title: 'Stake real tokens on YES or NO',
    body: 'Open any market and stake native GEN on whether the full chain will occur. Your stake is a real on-chain value transfer into the market pools. Odds shift with the pool ratio, and you can stake any time before the deadline.',
    accent: 'text-tertiary',
  },
  {
    icon: '🔍',
    title: 'GenLayer adjudicates with real evidence',
    body: 'When the deadline passes, adjudication triggers automatically. GenLayer validators independently fetch each step’s declared evidence sources — live news pages, official announcements — reason over the actual content with AI, and reach consensus. Every verdict’s reasoning is stored on-chain for you to audit.',
    accent: 'text-primary',
  },
  {
    icon: '💰',
    title: 'Claim and withdraw winnings',
    body: 'If your side wins, winners split the losing pool pro-rata. Head to Portfolio → Claim to credit your balance, then Withdraw to move tokens back to your wallet as a real native transfer. That’s the whole loop — welcome to the Causal Web.',
    accent: 'text-tertiary',
  },
];

const LS_KEY = 'ew:walkthrough-done';

export function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // ?tour=0 suppresses the auto-tour (embeds, screenshots, deep links)
    const suppressed = new URLSearchParams(window.location.search).get('tour') === '0';
    if (!suppressed && !localStorage.getItem(LS_KEY)) setOpen(true);
    const reopen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener('ew:open-walkthrough', reopen);
    return () => window.removeEventListener('ew:open-walkthrough', reopen);
  }, []);

  const finish = () => {
    localStorage.setItem(LS_KEY, '1');
    setOpen(false);
  };

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="EventWeaver walkthrough"
    >
      <div className="glass w-full max-w-lg rounded-2xl border-primary/20 p-8">
        <div className="mb-6 flex items-center justify-between">
          <LogoMark size={32} />
          <button
            onClick={finish}
            className="label-caps text-outline transition-colors hover:text-on-surface"
            aria-label="Skip walkthrough"
          >
            Skip
          </button>
        </div>

        <div className="mb-2 text-4xl">{s.icon}</div>
        <h2
          className={`mb-3 text-2xl font-bold ${s.accent}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {s.title}
        </h2>
        <p className="min-h-28 leading-relaxed text-on-variant">{s.body}</p>

        {/* progress dots */}
        <div className="my-6 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-outline-variant hover:bg-outline'}`}
            />
          ))}
        </div>

        <div className="flex justify-between gap-3">
          <button
            onClick={() => setStep((x) => Math.max(0, x - 1))}
            disabled={step === 0}
            className="rounded-lg border border-outline-variant px-5 py-2.5 text-sm text-on-variant transition-colors hover:bg-white/5 disabled:opacity-30"
          >
            ← Back
          </button>
          <button
            onClick={() => (last ? finish() : setStep((x) => x + 1))}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-transform active:scale-95"
          >
            {last ? 'Start weaving →' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fire this anywhere to reopen the tour. */
export function openWalkthrough() {
  window.dispatchEvent(new Event('ew:open-walkthrough'));
}
