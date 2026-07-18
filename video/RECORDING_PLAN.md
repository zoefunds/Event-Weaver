# RECORDING_PLAN — EventWeaver

## Setup
- Target: https://eventweaver-orpin.vercel.app (live production frontend)
- Capture via Claude's Browser pane (Chromium-based), 1920×1080 viewport, `?tour=0` to
  suppress the onboarding walkthrough during capture (unless the walkthrough itself is the
  target).
- Use whatever demo/curated markets are currently live on the deployed app (README notes
  "curated real-world demo markets" replaced legacy markets) — do not fabricate market
  content; use exactly what's rendered.
- No wallet is connected during capture (no MetaMask extension in the Browser pane) — the
  stake/withdraw wallet-modal shots are therefore Remotion reconstructions per
  ASSET_MANIFEST.md, not live recordings. This is disclosed, not hidden.

## Shot list
1. Landing page — full viewport screenshot.
2. Discovery/markets page — full viewport + one card hover state.
3. A resolved market detail page — full viewport + scroll to the resolution
   report/reasoning section.
4. Create-market page — Visual Logic Builder, empty state and mid-fill state (2 shots).
5. Portfolio page — whatever state is reachable without a connected wallet (likely empty/
   connect-prompt state); note this honestly in asset notes if no positions are visible.

## Capture standards applied
- Clean browser chrome (no extra tabs visible in crops — Remotion BrowserFrame replaces
  the real browser chrome anyway, so raw screenshots just need clean page content).
- No personal data — public deployed app, no login required for browsing.
- Full-page screenshots at native resolution, cropped/masked later in Remotion rather than
  during capture, so scenes can reframe without re-capturing.

## Known gap
- No MetaMask-connected wallet flow (stake, claim, withdraw confirmation) could be
  captured live in this pass. This is recorded in ASSET_MANIFEST.md as a disclosed
  reconstruction, not a fabricated live capture.
