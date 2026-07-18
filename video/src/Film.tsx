import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { HookScene } from './scenes/HookScene';
import { ProblemScene } from './scenes/ProblemScene';
import { RevealScene } from './scenes/RevealScene';
import { OverviewScene } from './scenes/OverviewScene';
import { LandingScene } from './scenes/LandingScene';
import { DiscoveryScene } from './scenes/DiscoveryScene';
import { MarketDetailScene } from './scenes/MarketDetailScene';
import { CreateScene } from './scenes/CreateScene';
import { StakeScene } from './scenes/StakeScene';
import { MechanismSetupScene } from './scenes/MechanismSetupScene';
import { MechanismCoreScene } from './scenes/MechanismCoreScene';
import { TransparencyScene } from './scenes/TransparencyScene';
import { SettlementScene } from './scenes/SettlementScene';
import { RecapScene } from './scenes/RecapScene';
import { ClosingScene } from './scenes/ClosingScene';
import { CaptionLine } from './components/CaptionLine';
import { SCENES, VO_FILES, TEASER_KEYS, TEASER_CAPS } from './constants';
import { theme } from './theme';

type SceneKey = keyof typeof SCENES;

const SCENE_LIST: Array<{ key: SceneKey; Component: React.FC }> = [
  { key: 'hook', Component: HookScene },
  { key: 'problem', Component: ProblemScene },
  { key: 'reveal', Component: RevealScene },
  { key: 'overview', Component: OverviewScene },
  { key: 'landing', Component: LandingScene },
  { key: 'discovery', Component: DiscoveryScene },
  { key: 'marketDetail', Component: MarketDetailScene },
  { key: 'create', Component: CreateScene },
  { key: 'stake', Component: StakeScene },
  { key: 'mechanismSetup', Component: MechanismSetupScene },
  { key: 'mechanismCore', Component: MechanismCoreScene },
  { key: 'transparency', Component: TransparencyScene },
  { key: 'settlement', Component: SettlementScene },
  { key: 'recap', Component: RecapScene },
  { key: 'closing', Component: ClosingScene },
];

// Caption text per scene — paraphrased/trimmed from VOICEOVER_SCRIPT.md, split into two
// beats for scenes longer than ~600 frames so no single caption sits on screen too long.
const CAPTIONS: Array<{ start: number; end: number; text: string }> = [
  { start: SCENES.hook.start, end: SCENES.hook.end, text: 'Three claims, in order. In the real world, they’re connected.' },
  { start: SCENES.problem.start, end: SCENES.problem.start + 380, text: 'Who decides if the chain happened? Usually: whoever runs the platform.' },
  { start: SCENES.problem.start + 380, end: SCENES.problem.end, text: 'They see the same evidence you do — and hold every dollar staked.' },
  { start: SCENES.reveal.start, end: SCENES.reveal.end, text: 'EventWeaver — resolved by consensus, not by whoever runs the site.' },
  { start: SCENES.overview.start, end: SCENES.overview.end, text: 'All steps, in order → YES. Any one breaks → NO.' },
  { start: SCENES.landing.start, end: SCENES.landing.end, text: 'The live app today — real markets, real staking, on GenLayer testnet.' },
  { start: SCENES.discovery.start, end: SCENES.discovery.end, text: 'Browse every market before committing anything — filter by status or category.' },
  { start: SCENES.marketDetail.start, end: SCENES.marketDetail.start + 620, text: 'Vision Pro → iPhone 16 → a still-unresolved foldable iPhone.' },
  { start: SCENES.marketDetail.start + 620, end: SCENES.marketDetail.end, text: 'Real validator reasoning, citing Wikipedia and apple.com as evidence.' },
  { start: SCENES.create.start, end: SCENES.create.start + 460, text: 'Anyone can define a chain — condition plus public evidence, per step.' },
  { start: SCENES.create.start + 460, end: SCENES.create.end, text: 'A confidence floor sets how strong that evidence has to be.' },
  { start: SCENES.stake.start, end: SCENES.stake.end, text: 'Staking is a direct wallet transaction — EventWeaver never holds your funds.' },
  { start: SCENES.mechanismSetup.start, end: SCENES.mechanismSetup.end, text: 'After the deadline, resolution is automatic — the resolver only triggers it.' },
  { start: SCENES.mechanismCore.start, end: SCENES.mechanismCore.start + 750, text: 'Validators independently fetch evidence inside GenVM and reason over it.' },
  { start: SCENES.mechanismCore.start + 750, end: SCENES.mechanismCore.end, text: 'They agree on the outcome, not the wording — verified live, one round.' },
  { start: SCENES.transparency.start, end: SCENES.transparency.end, text: 'Every step’s reasoning is written on-chain — check the evidence yourself.' },
  { start: SCENES.settlement.start, end: SCENES.settlement.end, text: 'Winners split the losing pool. Withdrawing sends a real on-chain transfer.' },
  { start: SCENES.recap.start, end: SCENES.recap.end, text: 'Live on testnet today — 24 tests passing, full lifecycle verified end to end.' },
  { start: SCENES.closing.start, end: SCENES.closing.end, text: 'A chain of events deserves a chain of proof.' },
];

export const Film: React.FC<{ format: 'landscape' | 'vertical' | 'square'; teaser?: boolean }> = ({
  format,
  teaser = false,
}) => {
  const frame = useCurrentFrame();

  if (teaser) {
    let cursor = 0;
    const placements = TEASER_KEYS.map((key) => {
      const dur = TEASER_CAPS[key];
      const placement = { key, start: cursor, end: cursor + dur };
      cursor += dur;
      return placement;
    });
    return (
      <AbsoluteFill style={{ background: theme.color.bg }}>
        {placements.map(({ key, start, end }) => {
          const Component = SCENE_LIST.find((s) => s.key === key)!.Component;
          return (
            <Sequence key={key} from={start} durationInFrames={end - start}>
              <Component />
              <Audio src={staticFile(VO_FILES[key])} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
  }

  const caption = CAPTIONS.find((c) => frame >= c.start && frame < c.end);

  return (
    <AbsoluteFill style={{ background: theme.color.bg }}>
      {SCENE_LIST.map(({ key, Component }) => {
        const range = SCENES[key];
        return (
          <Sequence key={key} from={range.start} durationInFrames={range.end - range.start}>
            <Component />
            <Audio src={staticFile(VO_FILES[key])} />
          </Sequence>
        );
      })}

      {format === 'landscape' && caption && <CaptionLine text={caption.text} visible />}
    </AbsoluteFill>
  );
};
