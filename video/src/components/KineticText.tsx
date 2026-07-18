import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

export const KineticText: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  weight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  font?: string;
  letterSpacing?: number;
}> = ({
  children,
  delay = 0,
  size = 64,
  weight = 700,
  color = theme.color.textPrimary,
  align = 'left',
  maxWidth,
  font = theme.font.display,
  letterSpacing,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: localFrame,
    fps,
    config: { damping: 200, mass: 0.6, stiffness: 120 },
  });

  const translateY = interpolate(progress, [0, 1], [22, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color,
        textAlign: align,
        maxWidth,
        lineHeight: 1.15,
        letterSpacing,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};
