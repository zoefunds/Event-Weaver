import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

export const Cursor: React.FC<{ x: number; y: number; clickAt?: number; delay?: number }> = ({
  x,
  y,
  clickAt,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const opacity = interpolate(local, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const clickScale = clickAt
    ? interpolate(local, [clickAt - 4, clickAt, clickAt + 10], [1, 0.85, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  const pulseOpacity = clickAt
    ? interpolate(local, [clickAt, clickAt + 20], [0.7, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const pulseScale = clickAt
    ? interpolate(local, [clickAt, clickAt + 20], [0.3, 2.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity }}>
      {clickAt && (
        <div
          style={{
            position: 'absolute',
            left: -18,
            top: -18,
            width: 36,
            height: 36,
            borderRadius: 999,
            border: `2px solid ${theme.color.logicBlue}`,
            opacity: pulseOpacity,
            transform: `scale(${pulseScale})`,
          }}
        />
      )}
      <div style={{ transform: `scale(${clickScale})` }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
          <path d="M4 2l14 8-6 2-2 6-6-16z" />
        </svg>
      </div>
    </div>
  );
};
