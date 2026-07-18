import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

export const EvidenceCard: React.FC<{
  label: string;
  value: string;
  accent?: string;
  delay?: number;
}> = ({ label, value, accent = theme.color.emerald, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const progress = spring({ frame: local, fps, config: { damping: 200, mass: 0.6, stiffness: 140 } });
  const translateY = interpolate(progress, [0, 1], [16, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        transform: `translateY(${translateY}px)`,
        opacity,
        background: theme.color.surface,
        border: `1px solid ${theme.color.surfaceBorder}`,
        borderRadius: theme.radius.md,
        padding: '18px 26px',
        minWidth: 240,
      }}
    >
      <div
        style={{
          fontFamily: theme.font.mono,
          fontSize: 14,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: theme.color.textMuted,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: theme.font.display, fontSize: 34, fontWeight: 700, color: accent }}>
        {value}
      </div>
    </div>
  );
};
