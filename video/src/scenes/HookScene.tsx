import React from 'react';
import { interpolate } from 'remotion';
import { Scene } from '../components/Scene';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

const STEPS = [
  { label: 'Apple releases Vision Pro', state: 'FULFILLED' as const },
  { label: 'Apple releases iPhone 16', state: 'FULFILLED' as const },
  { label: 'Apple announces a foldable iPhone', state: 'FAILED' as const },
];

const StepCard: React.FC<{ label: string; state: 'FULFILLED' | 'FAILED'; delay: number; frame: number }> = ({
  label,
  state,
  delay,
  frame,
}) => {
  const local = frame - delay;
  const opacity = interpolate(local, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isFail = state === 'FAILED';
  // step 3 flips from PENDING amber to FAILED red around frame 100 (local ~40 after its delay)
  const flipped = isFail && local > 40;
  const color = isFail ? (flipped ? theme.color.fail : '#e8c15a') : theme.color.emerald;

  return (
    <div
      style={{
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 640,
        padding: '18px 26px',
        borderRadius: theme.radius.md,
        background: theme.color.surface,
        border: `1.5px solid ${color}`,
      }}
    >
      <div style={{ fontFamily: theme.font.body, fontSize: 24, color: theme.color.textPrimary }}>{label}</div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 15, fontWeight: 700, color }}>
        {isFail ? (flipped ? 'FAILED' : 'PENDING') : 'FULFILLED'}
      </div>
    </div>
  );
};

export const HookScene: React.FC = () => {
  const duration = SCENES.hook.end - SCENES.hook.start;
  return (
    <Scene from={SCENES.hook.start} durationInFrames={duration}>
      {(frame) => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 20 }}>
            <StepCard label={STEPS[0].label} state={STEPS[0].state} delay={5} frame={frame} />
            <StepCard label={STEPS[1].label} state={STEPS[1].state} delay={20} frame={frame} />
            <StepCard label={STEPS[2].label} state={STEPS[2].state} delay={35} frame={frame} />
            <div style={{ marginTop: 30 }}>
              <KineticText delay={95} size={40} weight={600} color={theme.color.textSecondary}>
                one broken link. every dollar moves.
              </KineticText>
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
