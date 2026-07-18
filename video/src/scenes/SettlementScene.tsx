import React from 'react';
import { staticFile } from 'remotion';
import { Scene } from '../components/Scene';
import { StateMachine } from '../components/StateMachine';
import { EvidenceCard } from '../components/EvidenceCard';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { BrowserFrame } from '../components/BrowserFrame';
import { theme } from '../theme';
import { SCENES } from '../constants';

export const SettlementScene: React.FC = () => {
  const duration = SCENES.settlement.end - SCENES.settlement.start;
  return (
    <Scene from={SCENES.settlement.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: 60 }}>
            <div style={{ flex: 1.1, display: 'flex', flexDirection: 'column', gap: 28 }}>
              <KineticText size={30} weight={600} color={theme.color.textSecondary}>
                claim → withdraw → real transfer
              </KineticText>
              <StateMachine states={['CLAIM', 'WITHDRAW', 'NATIVE TRANSFER']} activeIndex={2} perStateFrames={1} delay={10} />
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10 }}>
                <EvidenceCard label="Protocol fee" value="1%" delay={40} accent={theme.color.textSecondary} />
                <EvidenceCard label="Creator fee" value="0.5%" delay={55} accent={theme.color.textSecondary} />
              </div>
              <EvidenceCard label="Winners split" value="Losing pool, pro-rata" delay={70} accent={theme.color.emerald} />
              <div style={{ fontFamily: theme.font.body, fontSize: 14, color: theme.color.textMuted, marginTop: 4, maxWidth: 480 }}>
                Illustrative math from the published fee schedule — exercised end-to-end on StudioNet.
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.textMuted }}>
                PORTFOLIO — WALLET-GATED, NO FAKE POSITIONS SHOWN
              </div>
              <BrowserFrame src={staticFile('video/clips/portfolio.mp4')} kind="video" width="100%" delay={30} loopFrames={126} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
