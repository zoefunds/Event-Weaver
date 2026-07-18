import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

export const EndCard: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const progress = spring({ frame: local, fps, config: { damping: 200, mass: 0.7, stiffness: 120 } });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const translateY = interpolate(progress, [0, 1], [14, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: theme.font.display,
          fontSize: 56,
          fontWeight: 800,
          background: `linear-gradient(90deg, ${theme.color.logicBlueLight}, ${theme.color.logicBlue})`,
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        EventWeaver
      </div>
      <div style={{ fontFamily: theme.font.body, fontSize: 22, color: theme.color.textSecondary }}>
        Chain-of-events prediction markets on GenLayer
      </div>
      <div
        style={{
          fontFamily: theme.font.mono,
          fontSize: 14,
          color: theme.color.emerald,
          border: `1px solid ${theme.color.emerald}`,
          borderRadius: 999,
          padding: '4px 14px',
          marginTop: 6,
        }}
      >
        LIVE ON STUDIONET
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 18, color: theme.color.textPrimary, marginTop: 10 }}>
        eventweaver-orpin.vercel.app
      </div>
      <div style={{ fontFamily: theme.font.body, fontSize: 14, color: theme.color.textMuted, marginTop: 20 }}>
        Built on GenLayer · Optimistic Democracy consensus
      </div>
    </div>
  );
};
