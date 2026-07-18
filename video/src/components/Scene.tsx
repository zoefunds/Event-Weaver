import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

// Wraps every scene: relative-frame context + a shared fade/mask-wipe transition in/out.
export const Scene: React.FC<{
  from: number;
  durationInFrames: number;
  children: (relativeFrame: number) => React.ReactNode;
  background?: string;
}> = ({ durationInFrames, children, background = theme.color.bg }) => {
  const frame = useCurrentFrame();
  const { transitionFrames } = theme.motion;

  const opacity = interpolate(
    frame,
    [0, transitionFrames, durationInFrames - transitionFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const wipeInset = interpolate(
    frame,
    [0, transitionFrames],
    [3, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ background }}>
      <AbsoluteFill
        style={{
          opacity,
          clipPath: `inset(${wipeInset}% round 0px)`,
        }}
      >
        {children(frame)}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
