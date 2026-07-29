/**
 * Detects when a new build has been deployed and reloads the tab.
 *
 * A stale tab keeps running whatever JS bundle it loaded at page-open time,
 * including any hardcoded config (API URL, contract address) baked in at
 * that build. If the backend or contract is later moved, a tab left open
 * from before the move keeps calling the old, now-dead endpoint forever —
 * surfacing as "Failed to fetch" on every screen with no way for the user
 * to tell why. Polling for a build change and reloading closes that gap.
 */

const BUNDLE_RE = /assets\/index-[^"']+\.js/;
const POLL_MS = 5 * 60 * 1000;
const REQUIRED_CONSECUTIVE_MISMATCHES = 2;

function currentBundleRef(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="assets/index-"]');
  return script?.getAttribute('src') ?? null;
}

export function startVersionCheck(): void {
  const baseline = currentBundleRef();
  if (!baseline) return; // dev server / unexpected markup — nothing to compare against

  let mismatches = 0;

  const check = async () => {
    try {
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const match = html.match(BUNDLE_RE);
      if (!match) return;
      if (`/${match[0]}` === baseline || match[0] === baseline) {
        mismatches = 0;
        return;
      }
      mismatches += 1;
      if (mismatches >= REQUIRED_CONSECUTIVE_MISMATCHES) {
        // A new build shipped while this tab was open. Any state cached
        // client-side (e.g. a previously connected wallet address) was
        // captured under the OLD build's assumptions — including config
        // like API/contract addresses that may since have moved. Clear it
        // so the reload starts clean rather than reapplying stale state on
        // top of new code.
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          // storage may be unavailable (private mode, disabled) — reload anyway
        }
        window.location.reload();
      }
    } catch {
      // Network hiccup during the check itself — ignore, try again next tick.
    }
  };

  setInterval(check, POLL_MS);
}
