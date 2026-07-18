# ASSET_MANIFEST — EventWeaver

## Existing repository assets
- `docs/images/landing.png` — landing page screenshot
- `docs/images/discovery.png` — market discovery screenshot
- `docs/images/market-detail.png` — resolved market with on-chain reasoning
- `docs/images/create-market.png` — Visual Logic Builder
- `docs/images/walkthrough.png` — onboarding tour
- Logo/favicon assets under `frontend/` (woven-chain logo)
- Brand colors from README design-system section (Logic Blue, Adjudication Purple,
  Emerald) — to be codified into `video/src/theme.ts`

## Newly captured screen recordings/screenshots (needed, not yet captured)
- Portfolio page (claim/withdraw panel) — not in `docs/images/`; capture via Browser
  pane against https://eventweaver-orpin.vercel.app
- Stake panel + MetaMask confirm modal — no live wallet recording exists; will be a
  faithful Remotion reconstruction per PRODUCT_TRUTH_MAP (labeled honestly, no fabricated
  tx hash)
- Fresh, higher-res captures of discovery/create pages if `docs/images/` screenshots are
  below 1080p or contain stale demo data

## Remotion-generated visuals (build in code, no external asset)
- Scene 1 chain-condition state cards (StateMachine component)
- Scene 2 abstract "centralized resolver" mockup
- Scene 3 logo hero lockup (EndCard/reused)
- Scene 7 ArchitectureFlow + ConsensusVisual + StateMachine (core technical diagram)
- Scene 8 TransactionReceipt-style settlement math card (EvidenceCard/MetricReveal)
- Scene 9 pulled-back ArchitectureFlow + EvidenceCard test/lint stats
- Scene 10 EndCard

## Pexo-generated visuals
- One (1) short 2–3s abstract atmospheric background plate behind the opening of Scene 7
  — see `PEXO_PROMPTS.md` #1. This is the only Pexo video asset in the master film.

## Icons
- Wallet icon (MetaMask), lock/padlock glyph, checkmark/fail glyph — use a small consistent
  icon set (e.g. Lucide) matching the product's existing icon style; do not use Font
  Awesome-style skeuomorphic icons that clash with the flat "Causal Web" design system.

## Sound effects
- UI confirm tick (short, ~100ms) — reused across Scenes 4–6, 7 (per-validator), 8
- Low tension pulse — Scene 1 FAILED cut
- Single confirm chime — Scene 3 reveal, Scene 7 consensus lock, Scene 8 resolve
- Final chime / tail — Scene 10
All SFX: source from a royalty-free/CC0 library (e.g. Remotion's audio examples or
freesound.org CC0 tracks) — to be finalized in `video/public/audio/sfx/`.

## Music
- One continuous instrumental bed, evolving per storyboard sound-design notes (tension →
  lift → momentum → confidence → resolution). Source: royalty-free instrumental track,
  license to be confirmed before final render. Placeholder track to be swapped before
  delivery if the final choice isn't cleared.

## Voiceover
- Generated via macOS built-in `say` command (per user instruction — Higgsfield voice
  generation unavailable in this environment). Rendered from `VOICEOVER_SCRIPT.md`,
  exported as AIFF then converted to WAV/MP3 for Remotion's `<Audio>` component.
- Voice: macOS neutral/professional voice (e.g. "Ava" or "Daniel" depending on system
  availability) — to be selected during generation and confirmed sounds acceptable before
  final render; a premium TTS/voice service is a reasonable future upgrade but out of
  scope for this pass.

## Missing (explicitly not fabricated)
- Real blockchain-explorer screenshot / specific transaction hash for a stake, claim, or
  withdraw call — none supplied, none captured. The film does not display one; the value-
  transfer claim is made via the on-chain diagram + README's documented "verified live on
  StudioNet" language only.
- Any user/adoption/funding metric — none exists, none will be shown.
