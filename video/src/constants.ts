export const FPS = 30;

// Scene frame ranges — sized to the generated VO clips (scripts/gen_vo.sh) plus 15
// frames of breathing room per scene. 15-scene, ~6.1 minute detailed cut.
export const SCENES = {
  hook: { start: 0, end: 581 },
  problem: { start: 581, end: 1372 },
  reveal: { start: 1372, end: 1635 },
  overview: { start: 1635, end: 2494 },
  landing: { start: 2494, end: 2800 },
  discovery: { start: 2800, end: 3304 },
  marketDetail: { start: 3304, end: 4552 },
  create: { start: 4552, end: 5480 },
  stake: { start: 5480, end: 6031 },
  mechanismSetup: { start: 6031, end: 6908 },
  mechanismCore: { start: 6908, end: 8425 },
  transparency: { start: 8425, end: 8957 },
  settlement: { start: 8957, end: 9720 },
  recap: { start: 9720, end: 10682 },
  closing: { start: 10682, end: 11028 },
} as const;

export const MASTER_DURATION = 11028; // ~367.6s @ 30fps (~6.1 min)
export const TEASER_DURATION = 900; // 30s @ 30fps

export const VO_FILES: Record<keyof typeof SCENES, string> = {
  hook: 'audio/vo/01_hook.wav',
  problem: 'audio/vo/02_problem.wav',
  reveal: 'audio/vo/03_reveal.wav',
  overview: 'audio/vo/04_overview.wav',
  landing: 'audio/vo/05_landing.wav',
  discovery: 'audio/vo/06_discovery.wav',
  marketDetail: 'audio/vo/07_market_detail.wav',
  create: 'audio/vo/08_create.wav',
  stake: 'audio/vo/09_stake.wav',
  mechanismSetup: 'audio/vo/10_mechanism_setup.wav',
  mechanismCore: 'audio/vo/11_mechanism_core.wav',
  transparency: 'audio/vo/12_transparency.wav',
  settlement: 'audio/vo/13_settlement.wav',
  recap: 'audio/vo/14_recap.wav',
  closing: 'audio/vo/15_closing.wav',
};

export const TEASER_KEYS: Array<keyof typeof SCENES> = ['hook', 'reveal', 'mechanismCore', 'closing'];
export const TEASER_CAPS: Record<string, number> = {
  hook: 180,
  reveal: 200,
  mechanismCore: 350,
  closing: 170,
};
