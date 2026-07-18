import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { Scene } from '../components/Scene';
import { EndCard } from '../components/EndCard';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const ClosingScene: React.FC = () => {
  const duration = SCENES.closing.end - SCENES.closing.start;
  return (
    <Scene from={SCENES.closing.start} durationInFrames={duration}>
      {(frame) => <ClosingContent frame={frame} />}
    </Scene>
  );
};

const ClosingContent: React.FC<{ frame: number }> = ({ frame }) => {
  const lineOpacity = interpolate(frame, [0, 15, 55, 70], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <SafeArea format="landscape">
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', opacity: lineOpacity }}>
          <KineticText size={38} weight={600} align="center" color={theme.color.textPrimary} maxWidth={900}>
            a chain of events deserves a chain of proof.
          </KineticText>
        </div>
        <div style={{ opacity: interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <EndCard delay={55} />
        </div>
      </div>
    </SafeArea>
  );
};
