import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

export const StateMachine: React.FC<{
  states: string[];
  activeIndex: number; // which state is "current" given the frame
  perStateFrames: number;
  delay?: number;
}> = ({ states, activeIndex, delay = 0 }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  const opacity = interpolate(local, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity, fontFamily: theme.font.mono }}>
      {states.map((s, i) => {
        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        return (
          <React.Fragment key={s}>
            <div
              style={{
                padding: '10px 18px',
                borderRadius: theme.radius.sm,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: 1,
                border: `1.5px solid ${isActive ? theme.color.logicBlue : theme.color.surfaceBorder}`,
                color: isActive ? theme.color.logicBlueLight : isPast ? theme.color.textSecondary : theme.color.textMuted,
                background: isActive ? 'rgba(77,142,255,0.12)' : 'transparent',
              }}
            >
              {s}
            </div>
            {i < states.length - 1 && (
              <div style={{ color: theme.color.textMuted, fontSize: 20 }}>→</div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
