import React from 'react';
import { Scene } from '../components/Scene';
import { EvidenceCard } from '../components/EvidenceCard';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const RecapScene: React.FC = () => {
  const duration = SCENES.recap.end - SCENES.recap.start;
  return (
    <Scene from={SCENES.recap.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 26 }}>
            <KineticText size={34} weight={700}>
              StudioNet today · mainnet-ready architecture
            </KineticText>
            <div style={{ display: 'flex', gap: 20 }}>
              <EvidenceCard label="Status" value="Live · testnet" accent={theme.color.emerald} delay={15} />
              <EvidenceCard label="Direct tests" value="24 passing" delay={30} />
              <EvidenceCard label="Lint" value="Clean · CI" delay={45} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
