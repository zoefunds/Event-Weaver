import React from 'react';
import { interpolate } from 'remotion';
import { Scene } from '../components/Scene';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const ProblemScene: React.FC = () => {
  const duration = SCENES.problem.end - SCENES.problem.start;
  return (
    <Scene from={SCENES.problem.start} durationInFrames={duration}>
      {(frame) => {
        const scale = interpolate(frame, [0, duration], [1, 1.12]);
        return (
          <SafeArea format="landscape">
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ transform: `scale(${scale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
                <div
                  style={{
                    width: 340,
                    padding: '34px 40px',
                    borderRadius: theme.radius.lg,
                    border: `1.5px solid ${theme.color.fail}`,
                    background: theme.color.surface,
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={theme.color.fail} strokeWidth="1.6">
                    <rect x="5" y="10" width="14" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
                  </svg>
                  <div style={{ fontFamily: theme.font.mono, fontSize: 16, color: theme.color.textSecondary }}>
                    RESOLVE MARKET
                  </div>
                </div>
                <KineticText delay={10} size={44} weight={600} align="center" maxWidth={720}>
                  whoever resolves the market...
                </KineticText>
                <KineticText delay={45} size={44} weight={700} align="center" color={theme.color.fail} maxWidth={720}>
                  controls the money.
                </KineticText>
              </div>
            </div>
          </SafeArea>
        );
      }}
    </Scene>
  );
};
