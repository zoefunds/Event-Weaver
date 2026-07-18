# STORYBOARD — EventWeaver (Landscape Master, 90s, 30fps, 1920×1080)

Structure: hybrid of **C (claim → verification)** and **A (problem → proof)** — fits a
consensus/oracle product better than a pure user-transformation arc.
Transition vocabulary (reused throughout, not varied per-scene): (1) mask-wipe through a
UI panel edge, (2) push-in-to-zoom that resolves into the next scene, (3) state-change
flash cut on verdict reveals. No other transition types are used.

---

**Scene 1 — Cold open / hook**
Frame: 0:00–0:05 (150f)
Purpose: pattern-break hook — a chain of claims, one of which is already broken.
VO: "Apple ships the Vision Pro. Then the iPhone 16. Then — maybe — a foldable phone.
Three claims. Only one needs to fail."
On-screen copy: "one broken link. every dollar moves."
Visual: Three condition cards stacked vertically (ChainViz-style), first two glow green
(FULFILLED), third pulses amber (PENDING) then cuts to red (FAILED) on a hard beat.
Real asset required: real step text/labels from the product's chain-condition format.
Remotion: KineticText + StateMachine component, custom build, no stock footage.
Pexo: none.
Transition out: state-change flash cut.
Sound cue: single low tension pulse on the FAILED cut.
Proof shown: none yet — this is the tension setup.
Viewer takeaway: chained conditions are fragile — who decides they broke?

---

**Scene 2 — Problem / stakes**
Frame: 0:05–0:15 (300f)
Purpose: establish why resolution is a trust problem, not an inference problem.
VO: "Someone has to decide if that happened. In most prediction markets, that someone
controls the payout."
On-screen copy: "whoever resolves the market... controls the money."
Visual: single centered UI mockup of a generic "admin resolves market" button with a
padlock/warning glyph — abstracted, not a real competitor's UI. Push-in on the button.
Real asset required: none (conceptual, clearly abstract, not depicting a real company).
Remotion: FocusZoom + KineticText.
Pexo: none needed — Remotion abstraction is more precise than stock footage here.
Transition out: push-in-to-zoom resolving into Scene 3's product reveal.
Sound cue: low synth swell, building.
Proof shown: none — problem framing only.
Viewer takeaway: centralized resolution is the actual risk, not the prediction itself.

---

**Scene 3 — Product reveal**
Frame: 0:15–0:23 (240f)
Purpose: name lands as the answer.
VO: "EventWeaver. Chain-of-events markets, resolved by consensus — not by a server."
On-screen copy: "EventWeaver" (logo lockup, 1.5s hero hold)
Visual: woven-chain logo assembles from the same condition-card chain used in Scene 1
(visual rhyme), Logic Blue → Adjudication Purple gradient sweep on wordmark only.
Real asset required: logo/favicon asset from `frontend/`.
Remotion: EndCard-style hero lockup component reused later for closing.
Pexo: none.
Transition out: mask-wipe through the wordmark into the live browser frame.
Sound cue: confident single chime, not a whoosh.
Proof shown: product name association with the mechanism just described.
Viewer takeaway: this is a specific, named, working product — not a concept pitch.

---

**Scene 4 — Product flow: Discovery**
Frame: 0:23–0:31 (240f)
Purpose: show the real app, real markets.
VO: "Every market on EventWeaver is a chain like this — live, browsable, and backed by
public evidence."
On-screen copy: "live causal-chain markets"
Visual: BrowserFrame around real `docs/images/discovery.png` (or fresh capture from
deployed app), animated card hover/scroll.
Real asset required: discovery page screenshot/recording — deployed app.
Remotion: BrowserFrame + ProductFrame, cursor-guided scroll.
Pexo: none.
Transition out: mask-wipe via card edge.
Sound cue: soft UI tick on scroll.
Proof shown: real live markets exist in the product today.
Viewer takeaway: this isn't a single demo market — it's a functioning market list.

---

**Scene 5 — Product flow: Create**
Frame: 0:31–0:41 (300f)
Purpose: show how a chain is actually built.
VO: "A creator defines each condition and attaches the public evidence that will decide it
— a news page, a filing, an official announcement."
On-screen copy: "condition + evidence, per step"
Visual: BrowserFrame around Visual Logic Builder (`create-market.png` / fresh capture),
Cursor adds a step, ClickPulse on "attach evidence URL" field.
Real asset required: create-market page screenshot/recording.
Remotion: BrowserFrame, Cursor, ClickPulse, FocusZoom on the evidence-URL field.
Pexo: none.
Transition out: mask-wipe.
Sound cue: UI confirm tick per step added.
Proof shown: real chain-authoring UI, real field structure.
Viewer takeaway: the evidence isn't abstract — it's a URL anyone can check themselves.

---

**Scene 6 — Product flow: Stake**
Frame: 0:41–0:49 (240f)
Purpose: show real value entering the system.
VO: "Anyone can stake on the outcome — a real transaction, straight from their wallet."
On-screen copy: "stake GEN · your wallet, not ours"
Visual: BrowserFrame stake panel + MetaMask confirmation modal appearing (reconstructed
faithfully from the real wallet integration flow, real field labels).
Real asset required: stake panel screenshot/recording; MetaMask modal can be a faithful
Remotion reconstruction since a live wallet-confirm recording was not captured.
Remotion: BrowserFrame + DeviceFrame (wallet modal), ClickPulse.
Pexo: none.
Transition out: mask-wipe.
Sound cue: single confirm tone.
Proof shown: staking is a direct wallet transaction (per README), not a custodial balance.
Viewer takeaway: EventWeaver never holds your funds.

---

**Scene 7 — Technical mechanism: adjudication**
Frame: 0:49–1:12 (690f) — the technical core, given the most time.
Purpose: explain how consensus verdicts actually form.
VO: "At the deadline, validators wake independently. Each one fetches the same evidence
page for itself — inside the contract, not through an API someone controls. Then they
reason over what they read, and they only agree if the verdict itself matches, not the
wording. One round. Majority agree. The reasoning is written on-chain, for anyone to
read."
On-screen copy: split across beats — "each validator fetches evidence, independently" /
"they must agree on the outcome, not the wording" / "reasoning, written on-chain"
Visual: ArchitectureFlow causal path, revealed progressively:
  evidence URL → [3 validator nodes fetch independently, in parallel] →
  [each produces a reasoning trace] → consensus check (`prompt_comparative`) →
  verdict lock (FULFILLED/FAILED, confidence %) → written to contract state.
State machine insert: WAITING → ELIGIBLE → TRIGGERED → EXECUTED beat under the diagram.
Real asset required: real step text and a real resolution-report excerpt
(`market-detail.png`) as the final on-chain reasoning proof.
Remotion: ArchitectureFlow, ConsensusVisual, StateMachine, EvidenceCard for the final
on-chain reasoning text (verbatim from screenshot, not invented copy).
Pexo: one short (2–3s) abstract atmospheric shot as a background plate behind the opening
of this scene only — see PEXO_PROMPTS.md #1. No fabricated UI or text in the Pexo shot.
Transition out: state-change flash into Scene 8.
Sound cue: escalating tick per validator node lighting up, resolving to a single confirm
chime on consensus lock.
Proof shown: this is the section carrying the film's core credibility claim — must map
directly to PRODUCT_TRUTH_MAP rows on adjudication.
Viewer takeaway: the decisive step is decentralized and inspectable, not asserted.

---

**Scene 8 — Result / settlement proof**
Frame: 1:12–1:22 (300f)
Purpose: show the value actually moves.
VO: "Winners split the losing pool. Withdrawing sends a real transfer, back to your
wallet — on-chain, every time."
On-screen copy: "claim → withdraw → real transfer"
Visual: TransactionReceipt-style card built from real README numbers only (1% protocol +
0.5% creator fee, pro-rata split formula) — labeled clearly as illustrative math, not a
captured transaction. Portfolio page screenshot/recording underneath.
Real asset required: portfolio page capture (needs fresh capture — not in docs/images).
Remotion: EvidenceCard, MetricReveal, BrowserFrame.
Pexo: none.
Transition out: pull-back from UI into full architecture view for Scene 9.
Sound cue: resolving chime, warmer register than Scene 7's.
Proof shown: settlement math and withdrawal mechanism, per README value-transfer table.
Viewer takeaway: this produces real payouts, not points.

---

**Scene 9 — Broader vision / evidence recap**
Frame: 1:22–1:28 (180f)
Purpose: zoom out to credibility signals + honest staging.
VO: "Live today on GenLayer's public testnet — twenty-four tests passing, the full
lifecycle verified end-to-end. Built to move to mainnet as GenLayer does."
On-screen copy: "StudioNet today · mainnet-ready architecture"
Visual: Full ArchitectureFlow pulled back (frontend/backend/contract), small persistent
"StudioNet · testnet" chip, EvidenceCard row: "24 tests passing · lint clean · CI on every
push."
Real asset required: none new — reuses Scene 7/8 components pulled back.
Remotion: ArchitectureFlow (wide state), EvidenceCard.
Pexo: none.
Transition out: mask-wipe into end card.
Sound cue: music settles, single low pad.
Proof shown: explicit, accurate staging statement (testnet, not mainnet).
Viewer takeaway: credible current state, honest about what's next.

---

**Global timing (master duration 93s / 2790f @ 30fps):**
1. 0:00–0:05 (150f) hook
2. 0:05–0:15 (300f) problem
3. 0:15–0:23 (240f) reveal
4. 0:23–0:31 (240f) discovery
5. 0:31–0:41 (300f) create
6. 0:41–0:49 (240f) stake
7. 0:49–1:12 (690f) mechanism
8. 1:12–1:22 (300f) settlement
9. 1:22–1:28 (180f) recap/staging
10. 1:28–1:33 (150f) closing

**Scene 10 — Closing** (1:28–1:33, 150f)
Purpose: memorable close + CTA end card.
VO: "A chain of events deserves a chain of proof. EventWeaver."
On-screen copy: "a chain of events deserves a chain of proof."
Visual: EndCard — logo, one-line positioning ("chain-of-events prediction markets on
GenLayer"), status chip ("live on StudioNet"), URL (eventweaver-orpin.vercel.app),
GenLayer attribution line ("Built on GenLayer · Optimistic Democracy consensus").
Real asset required: logo, URL text (exact, from README).
Remotion: EndCard, SafeArea-checked for all three aspect ratios.
Pexo: none.
Transition out: none (final frame).
Sound cue: final chime resolves to silence, music tail fades.
Proof shown: N/A — closing statement.
Viewer takeaway: the memorable idea to retain — proof should be chained the way the
events are.

---

## Notes for vertical (9:16) and square (1:1) cuts
Scenes 4–6 (BrowserFrame UI) recompose to full-bleed cropped UI panels with larger type
overlays, not shrunk landscape frames. Scene 7's ArchitectureFlow recomposes to a vertical
top-to-bottom flow instead of left-to-right. Caption style becomes more energetic
(word-group highlight) per the vertical caption guidance. Total duration for social cuts:
teaser variant trims to Scenes 1, 3, 7 (abbreviated), 10 only, ~25s.
