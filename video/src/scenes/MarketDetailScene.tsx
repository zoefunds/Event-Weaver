import React from 'react';
import { staticFile } from 'remotion';
import { Scene } from '../components/Scene';
import { BrowserFrame } from '../components/BrowserFrame';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const MarketDetailScene: React.FC = () => {
  const duration = SCENES.marketDetail.end - SCENES.marketDetail.start;
  return (
    <Scene from={SCENES.marketDetail.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 22 }}>
            <KineticText size={30} weight={600} color={theme.color.textSecondary}>
              real on-chain reasoning, not placeholder text
            </KineticText>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrowserFrame src={staticFile('video/clips/market-detail.mp4')} kind="video" loopFrames={331} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
