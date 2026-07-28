# VIDEO_BRIEF — EventWeaver

## One-sentence product definition
EventWeaver is a prediction-market platform where markets are ordered chains of dependent
real-world conditions (not single yes/no bets), resolved trustlessly by GenLayer's
decentralized AI-validator consensus reading live public web evidence on-chain.

## Target viewer
Crypto-native investors and technical evaluators (GenLayer ecosystem, prediction-market
and DeFi investors, hackathon/grant judges) who can tell a real working system from a mockup
and who care about *why* decentralization is structurally necessary here, not just that it
exists.

## Primary video objective
Investor/demo pitch: prove EventWeaver is a working, technically credible product solving a
real trust problem — get the viewer to want a follow-up conversation or to try the live app.

## Central message
"A chain of events needs a chain of proof — and that proof has to be decided by consensus,
not by whoever controls the payout."

## Intended emotion
Confident, credible, quietly impressive — investor-grade, not hype-grade.

## Current product stage
Working MVP on public testnet (GenLayer StudioNet). Contract deployed, backend live 24/7,
frontend live on Vercel. Not mainnet, not production financial infrastructure.

## Implemented capabilities (real, on-chain, demonstrable)
- Creating a multi-step causal-chain market via the Visual Logic Builder.
- Staking native GEN on YES/NO via MetaMask (real payable transaction).
- Adjudication: GenLayer validators independently fetch declared evidence URLs
  (`gl.nondet.web.render`) inside GenVM and reach consensus via
  `gl.eq_principle.prompt_comparative` — verified live on StudioNet (one-round
  MAJORITY_AGREE, zero leader rotations).
- Per-step on-chain reasoning + evidence summaries, shown in the UI's resolution report.
- Claim (settlement math with 1% protocol + 0.5% creator fee) and withdraw (real native
  token transfer via `emit_transfer`) — exercised end-to-end on StudioNet.
- Automatic deadline resolution triggered by an always-on backend resolver (backend does
  not decide outcomes — it only wakes the contract; validators decide).
- 24 passing direct unit tests, genvm-lint clean, CI on every push.

## Simulated / limited-scope capabilities
- Runs on GenLayer **StudioNet** (public testnet), not mainnet — GEN staked is testnet
  value, not real-money settlement yet.
- Evidence sources are whatever URLs the market creator declares; the film should not imply
  a fully autonomous, adversarially-hardened oracle network in production.

## Future capabilities (explicitly roadmap, not built)
- Mainnet deployment / real-value settlement.
- Broader validator/evidence-source decentralization guarantees beyond current StudioNet
  configuration.

## Principal call to action
"Try the live market chain at eventweaver-orpin.vercel.app — or talk to us about backing it
to mainnet."

## Final video duration
~90 seconds master (landscape). Optional 20–30s teaser cut for social.

## Output aspect ratios
16:9 (1920×1080, master) · 9:16 (1080×1920) · 1:1 (1080×1080)

## Brand direction
"Causal Web" dark glassmorphism. Logic Blue `#adc6ff` / `#4d8eff`, Adjudication Purple
`#571bc1`, Emerald `#4edea3` (success/positive). Fonts: Geist / Inter / JetBrains Mono
(mono for on-chain/technical data). Woven-chain logo motif. No purple-gradient/neon
cyberpunk cliché beyond what the product itself already uses.

## Evidence available
- Live deployed app: https://eventweaver-orpin.vercel.app
- Live backend health endpoint: https://eventweaver-api-prod.fly.dev/health
- Deployed contract address on StudioNet: `0x0361b5a160637407e7D93Ff8C1CC866855dD0cc2`
- Screenshots: `docs/images/landing.png`, `discovery.png`, `market-detail.png`,
  `create-market.png`, `walkthrough.png`
- README architecture/lifecycle diagrams, `docs/CONTRACT.md`, `docs/ARCHITECTURE.md`
- Test suite: 24 passing pytest tests, CI workflow

## Evidence missing (must not fabricate)
- No transaction-hash / explorer screenshot has been captured for this project yet.
- No screen recording of a live wallet stake/claim/withdraw flow has been captured yet.
- No user/adoption numbers exist (no user counts, TVL, or usage metrics — do not invent any).

## Claims that must not be made
- Do not say the platform runs on mainnet or settles real-world money today.
- Do not depict the backend resolver as the entity that "decides" outcomes — it only
  triggers; validators decide.
- Do not claim adversarial-oracle-proof security guarantees beyond what's documented.
- Do not invent user counts, TVL, funding, or team size.

## Open assumptions (recorded per instructions, since not explicitly specified)
- Voiceover: AI-generated, neutral/confident tone, ~140 wpm, generated via macOS built-in
  TTS (`say`) per user instruction (Higgsfield voice generation unavailable).
- No existing screen recordings supplied — screenshots in `docs/images/` plus a freshly
  captured local walkthrough (via browser preview) will serve as real product evidence.
  A live wallet transaction (stake/claim/withdraw with a real tx hash) was NOT captured for
  this cut; the film will show the flow up to the wallet-confirm step and rely on the README
  documented on-chain verification instead of fabricating a receipt.
