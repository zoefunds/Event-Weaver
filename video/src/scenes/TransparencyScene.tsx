import React from 'react';
import { staticFile } from 'remotion';
import { Scene } from '../components/Scene';
import { BrowserFrame } from '../components/BrowserFrame';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const TransparencyScene: React.FC = () => {
  const duration = SCENES.transparency.end - SCENES.transparency.start;
  return (
    <Scene from={SCENES.transparency.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 22 }}>
            <KineticText size={30} weight={600} color={theme.color.textSecondary}>
              reasoning, written on-chain
            </KineticText>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrowserFrame src={staticFile('images/market-detail.png')} kind="image" />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
