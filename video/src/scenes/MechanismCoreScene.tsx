import React from 'react';
import { interpolate } from 'remotion';
import { Scene } from '../components/Scene';
import { ArchitectureFlow } from '../components/ArchitectureFlow';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

const BEATS = [
  { at: 20, text: 'each validator fetches evidence, independently — inside GenVM' },
  { at: 260, text: 'they reason over it, and produce a verdict + confidence' },
  { at: 520, text: 'they must agree on the outcome — not the wording' },
  { at: 780, text: 'verified live: one round, majority agree, zero leader rotations' },
];

export const MechanismCoreScene: React.FC = () => {
  const duration = SCENES.mechanismCore.end - SCENES.mechanismCore.start;
  return (
    <Scene from={SCENES.mechanismCore.start} durationInFrames={duration}>
      {(frame) => {
        const activeBeat = BEATS.filter((b) => frame >= b.at).pop();
        return (
          <SafeArea format="landscape">
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18 }}>
              <div style={{ height: 44 }}>
                {activeBeat && (
                  <KineticText key={activeBeat.text} size={28} weight={600} color={theme.color.textSecondary} maxWidth={1300}>
                    {activeBeat.text}
                  </KineticText>
                )}
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArchitectureFlow delay={0} validators={3} />
              </div>
            </div>
          </SafeArea>
        );
      }}
    </Scene>
  );
};
