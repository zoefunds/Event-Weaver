import React from 'react';
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Scene } from '../components/Scene';
import { BrowserFrame } from '../components/BrowserFrame';
import { KineticText } from '../components/KineticText';
import { SafeArea } from '../components/SafeArea';
import { theme } from '../theme';
import { SCENES } from '../constants';

// The wallet-confirm modal is a labeled reconstruction (no live wallet recording was
// captured — see RECORDING_PLAN.md). Field labels/amounts are illustrative, not a real tx.
const WalletModal: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const progress = spring({ frame: local, fps, config: { damping: 200, mass: 0.7, stiffness: 130 } });
  const translateY = interpolate(progress, [0, 1], [40, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        right: 40,
        top: 20,
        width: 340,
        transform: `translateY(${translateY}px)`,
        opacity,
        background: '#14161c',
        border: `1px solid ${theme.color.surfaceBorder}`,
        borderRadius: theme.radius.md,
        padding: 22,
        boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.textMuted, marginBottom: 10 }}>
        WALLET CONFIRMATION (RECONSTRUCTION)
      </div>
      <div style={{ fontFamily: theme.font.display, fontSize: 18, fontWeight: 700, color: theme.color.textPrimary }}>
        Stake YES
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 26, fontWeight: 700, color: theme.color.emerald, marginTop: 8 }}>
        50 GEN
      </div>
      <div style={{ fontFamily: theme.font.body, fontSize: 13, color: theme.color.textSecondary, marginTop: 10 }}>
        Sends value directly from your wallet to the contract.
      </div>
      <div
        style={{
          marginTop: 16,
          padding: '10px 0',
          borderRadius: theme.radius.sm,
          textAlign: 'center',
          background: theme.color.logicBlue,
          color: '#0a0e1a',
          fontFamily: theme.font.body,
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        Confirm
      </div>
    </div>
  );
};

export const StakeScene: React.FC = () => {
  const duration = SCENES.stake.end - SCENES.stake.start;
  return (
    <Scene from={SCENES.stake.start} durationInFrames={duration}>
      {() => (
        <SafeArea format="landscape">
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
            <KineticText size={30} weight={600} color={theme.color.textSecondary}>
              stake GEN · your wallet, not ours
            </KineticText>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BrowserFrame src={staticFile('images/market-detail.png')} />
              <WalletModal delay={20} />
            </div>
          </div>
        </SafeArea>
      )}
    </Scene>
  );
};
