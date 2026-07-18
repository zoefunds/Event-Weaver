import React from 'react';
import { interpolate } from 'remotion';
import { Scene } from '../components/Scene';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

const STEPS = [
  'Fed cuts rates in September',
  'housing starts rise',
  'a specific homebuilder beats earnings',
];

const StepPill: React.FC<{ label: string; index: number; delay: number; frame: number }> = ({
  label,
  index,
  delay,
  frame,
}) => {
  const local = frame - delay;
  const opacity = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const translateX = interpolate(local, [0, 14], [-16, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity, transform: `translateX(${translateX}px)`, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: `1.5px solid ${theme.color.logicBlue}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.font.mono,
          fontSize: 15,
          color: theme.color.logicBlueLight,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </div>
      <div style={{ fontFamily: theme.font.body, fontSize: 26, color: theme.color.textPrimary }}>{label}</div>
    </div>
  );
};

export const OverviewScene: React.FC = () => {
  const duration = SCENES.overview.end - SCENES.overview.start;
  return (
    <Scene from={SCENES.overview.start} durationInFrames={duration}>
      {(frame) => {
        const captionOpacity = interpolate(frame, [duration - 90, duration - 60], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <SafeArea format="landscape">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 46 }}>
              <KineticText size={34} weight={700}>
                a market is a chain, not a single bet
              </KineticText>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                {STEPS.map((s, i) => (
                  <StepPill key={s} label={s} index={i} delay={20 + i * 22} frame={frame} />
                ))}
              </div>
              <div style={{ opacity: captionOpacity, fontFamily: theme.font.mono, fontSize: 18, color: theme.color.emerald }}>
                ALL THREE, IN ORDER → YES · ANY ONE BREAKS → NO
              </div>
            </div>
          </SafeArea>
        );
      }}
    </Scene>
  );
};
