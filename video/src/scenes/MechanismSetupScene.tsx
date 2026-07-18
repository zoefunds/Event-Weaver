import React from 'react';
import { Scene } from '../components/Scene';
import { StateMachine } from '../components/StateMachine';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const MechanismSetupScene: React.FC = () => {
  const duration = SCENES.mechanismSetup.end - SCENES.mechanismSetup.start;
  return (
    <Scene from={SCENES.mechanismSetup.start} durationInFrames={duration}>
      {(frame) => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 40 }}>
            <KineticText size={34} weight={700} maxWidth={1100}>
              before the deadline: creator-triggered. after: automatic.
            </KineticText>
            <StateMachine
              states={['WAITING', 'ELIGIBLE', 'TRIGGERED', 'EXECUTED']}
              activeIndex={Math.min(3, Math.floor(frame / 40))}
              perStateFrames={40}
              delay={15}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div style={{ fontFamily: theme.font.body, fontSize: 20, color: theme.color.textSecondary }}>
                the backend resolver triggers resolution — it does not decide the outcome.
              </div>
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
