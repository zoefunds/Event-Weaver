import React from 'react';
import { interpolate, spring, useVideoConfig } from 'remotion';
import { Scene } from '../components/Scene';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const RevealScene: React.FC = () => {
  const duration = SCENES.reveal.end - SCENES.reveal.start;
  return (
    <Scene from={SCENES.reveal.start} durationInFrames={duration}>
      {(frame) => <RevealContent frame={frame} />}
    </Scene>
  );
};

const RevealContent: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 200, mass: 0.6, stiffness: 110 } });
  const scale = interpolate(progress, [0, 1], [0.85, 1]);
  const sweep = interpolate(frame, [0, 40], [0, 100], { extrapolateRight: 'clamp' });

  return (
    <SafeArea format="landscape">
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `scale(${scale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              fontFamily: theme.font.display,
              fontSize: 96,
              fontWeight: 800,
              backgroundImage: `linear-gradient(90deg, ${theme.color.logicBlueLight} ${sweep}%, ${theme.color.adjudicationPurple} ${sweep}%)`,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            EventWeaver
          </div>
          <KineticText delay={45} size={26} weight={500} color={theme.color.textSecondary} align="center">
            resolved by consensus, not by a server
          </KineticText>
        </div>
      </div>
    </SafeArea>
  );
};
