import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useWallet, contractWrite, nowTs } from '../lib/wallet';
import { useToast } from '../components/Toast';

interface StepDraft {
  description: string;
  sources: string;
}

const emptyStep = (): StepDraft => ({ description: '', sources: '' });

/** Create — the visual logic builder: chain steps, sources, parameters. */
export default function Create() {
  const { address, client, connect } = useWallet();
  const { push } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technology');
  const [categories, setCategories] = useState<string[]>(['Technology', 'Finance', 'Geopolitics']);
  const [deadline, setDeadline] = useState('');
  const [confidence, setConfidence] = useState(70);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep(), emptyStep()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.config().then((c) => c.categories?.length && setCategories(c.categories)).catch(() => {});
  }, []);

  const setStep = (i: number, patch: Partial<StepDraft>) =>
    setSteps((s) => s.map((st, j) => (j === i ? { ...st, ...patch } : st)));

  const validate = (): string | null => {
    if (!title.trim()) return 'Give your market a title.';
    if (!deadline) return 'Pick a deadline.';
    if (new Date(deadline).getTime() <= Date.now()) return 'Deadline must be in the future.';
    for (const [i, s] of steps.entries()) {
      if (!s.description.trim()) return `Step ${i + 1} needs a condition description.`;
      const urls = s.sources.split('\n').map((u) => u.trim()).filter(Boolean);
      if (!urls.length) return `Step ${i + 1} needs at least one evidence URL.`;
      for (const u of urls) {
        if (!/^https?:\/\//.test(u)) return `Step ${i + 1}: "${u.slice(0, 40)}" is not a valid http(s) URL.`;
      }
    }
    return null;
  };

  const deploy = async () => {
    if (!client) return connect();
    const problem = validate();
    if (problem) return push('error', problem);
    setBusy(true);
    try {
      const stepsPayload = steps.map((s) => ({
        description: s.description.trim(),
        sources: s.sources.split('\n').map((u) => u.trim()).filter(Boolean),
      }));
      await contractWrite(client, 'create_market', [
        title.trim(),
        description.trim(),
        category,
        JSON.stringify(stepsPayload),
        Math.floor(new Date(deadline).getTime() / 1000),
        nowTs(),
        confidence,
      ]);
      push('success', 'Market deployed on-chain. Redirecting to discovery…');
      setTimeout(() => navigate('/markets'), 2500);
    } catch (e) {
      push('error', (e as Error).message.slice(0, 160));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 pb-20 pt-24 md:px-16">
      <header className="mb-10">
        <div className="mb-2 flex items-center gap-3">
          <span className="label-caps rounded bg-tertiary/10 px-2 py-1 text-tertiary">Studio mode</span>
          <span className="text-sm text-on-variant">Draft: new causal prediction market</span>
        </div>
        <h1 className="mb-2 text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Visual Logic Builder
        </h1>
        <p className="max-w-2xl text-on-variant">
          Define the chain of causality. GenLayer validators will adjudicate each step against the
          evidence sources you declare here.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Config sidebar */}
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <div className="glass rounded-xl p-6">
            <h3 className="label-caps mb-6 text-on-surface">Market metadata</h3>
            <label className="label-caps mb-2 block text-on-variant">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Vision Pro Adoption Cascade"
              className="mb-4 w-full rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-on-surface outline-none focus:border-primary"
            />
            <label className="label-caps mb-2 block text-on-variant">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What ripple effect does this market track?"
              className="mb-4 w-full resize-none rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-sm text-on-surface outline-none focus:border-primary"
            />
            <label className="label-caps mb-2 block text-on-variant">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mb-4 w-full rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-on-surface outline-none focus:border-primary"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className="label-caps mb-2 block text-on-variant">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-black/40 px-4 py-3 text-on-surface outline-none focus:border-primary"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="label-caps mb-6 text-on-surface">Global parameters</h3>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-on-variant">Confidence floor</label>
              <span className="text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{confidence}%</span>
            </div>
            <input
              type="range"
              min={55}
              max={95}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-surface-highest"
            />
            <p className="mt-2 text-[11px] leading-tight text-outline">
              Minimum validator confidence for GenLayer to flip a step to FULFILLED or FAILED.
              Lower = resolves on weaker evidence; higher = stricter.
            </p>
          </div>

          <div className="glass rounded-xl p-6">
            <h3 className="label-caps mb-4 text-on-surface">Preview logic</h3>
            <div
              className="rounded bg-black/40 p-3 text-sm leading-relaxed text-primary"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {steps.map((s, i) => (
                <div key={i}>
                  <span className="text-tertiary">{i === 0 ? 'IF' : 'THEN'}</span>{' '}
                  ({s.description.trim() ? s.description.trim().slice(0, 38) : `Step_${i + 1}`})
                </div>
              ))}
              <div><span className="text-tertiary">ELSE</span> (EXPIRE → NO)</div>
            </div>
          </div>
        </div>

        {/* Chain canvas */}
        <div className="glass grid-bg relative col-span-12 rounded-xl p-6 md:p-12 lg:col-span-8">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2">
            {steps.map((step, i) => (
              <div key={i} className="flex w-full flex-col items-center">
                <div
                  className={`relative w-full rounded-xl border bg-surface-highest p-6 transition-transform hover:-translate-y-0.5 ${i === 0 ? 'border-primary/40' : 'border-secondary/40'}`}
                  style={{ boxShadow: '0 0 15px -3px rgba(173,198,255,0.25)' }}
                >
                  <div
                    className={`label-caps absolute -top-3 left-6 rounded px-3 py-1 ${i === 0 ? 'bg-primary text-on-primary' : 'bg-secondary-deep text-white'}`}
                  >
                    {i === 0 ? 'Trigger (A)' : `Dependent (${String.fromCharCode(65 + i)})`}
                  </div>
                  {steps.length > 2 && (
                    <button
                      onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}
                      className="absolute -top-3 right-4 rounded bg-surface-high px-2 py-1 text-xs text-error hover:bg-error/20"
                      aria-label={`Remove step ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                  <label className="label-caps mb-2 block text-outline">Condition description</label>
                  <textarea
                    value={step.description}
                    onChange={(e) => setStep(i, { description: e.target.value })}
                    maxLength={600}
                    rows={2}
                    placeholder="e.g. SpaceX Starship completes a successful orbital flight before Dec 31…"
                    className="mb-3 w-full resize-none rounded-lg border-none bg-surface-low px-3 py-2 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                  <label className="label-caps mb-2 block text-outline">Evidence source URLs (one per line, max 5)</label>
                  <textarea
                    value={step.sources}
                    onChange={(e) => setStep(i, { sources: e.target.value })}
                    rows={2}
                    placeholder={'https://www.spacex.com/updates\nhttps://www.reuters.com/technology/space/'}
                    className="w-full resize-none rounded-lg border-none bg-surface-low px-3 py-2 text-xs text-on-surface outline-none focus:ring-1 focus:ring-primary"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                {i < steps.length - 1 && (
                  <div className="flex flex-col items-center py-3">
                    <div className="h-6 w-[1.5px]" style={{ background: 'linear-gradient(180deg,#adc6ff,#d0bcff)' }} />
                    <div className="hex-node flex h-12 w-12 items-center justify-center border border-tertiary/50 bg-surface-mid text-sm text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
                      THEN
                    </div>
                    <div className="h-6 w-[1.5px]" style={{ background: 'linear-gradient(180deg,#d0bcff,#adc6ff)' }} />
                  </div>
                )}
              </div>
            ))}

            {steps.length < 12 && (
              <button
                onClick={() => setSteps((s) => [...s, emptyStep()])}
                className="group mt-6 flex flex-col items-center gap-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-outline-variant text-2xl text-outline transition-all group-hover:border-primary group-hover:text-primary">
                  +
                </span>
                <span className="label-caps text-outline transition-colors group-hover:text-primary">
                  Add chain step
                </span>
              </button>
            )}
          </div>

          <div className="mt-12 flex justify-end gap-4">
            <button
              onClick={deploy}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            >
              {busy ? 'Deploying on-chain…' : address ? '⤴ Deploy Market' : 'Connect wallet to deploy'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
