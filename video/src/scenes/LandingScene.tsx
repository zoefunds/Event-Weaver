import React from 'react';
import { staticFile } from 'remotion';
import { Scene } from '../components/Scene';
import { BrowserFrame } from '../components/BrowserFrame';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const LandingScene: React.FC = () => {
  const duration = SCENES.landing.end - SCENES.landing.start;
  return (
    <Scene from={SCENES.landing.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 22 }}>
            <KineticText size={30} weight={600} color={theme.color.textSecondary}>
              live today, not a mockup
            </KineticText>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrowserFrame src={staticFile('video/clips/landing.mp4')} kind="video" loopFrames={274} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
