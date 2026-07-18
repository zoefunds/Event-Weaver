import React from 'react';
import { staticFile } from 'remotion';
import { Scene } from '../components/Scene';
import { BrowserFrame } from '../components/BrowserFrame';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const DiscoveryScene: React.FC = () => {
  const duration = SCENES.discovery.end - SCENES.discovery.start;
  return (
    <Scene from={SCENES.discovery.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 22 }}>
            <KineticText size={30} weight={600} color={theme.color.textSecondary}>
              live causal-chain markets
            </KineticText>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrowserFrame src={staticFile('video/clips/discovery.mp4')} kind="video" loopFrames={266} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
