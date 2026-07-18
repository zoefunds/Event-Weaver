import React from 'react';
import { Img, Loop, OffthreadVideo, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// Faithful reconstruction of the product's own dark-glass chrome, framing either a real
// screen recording (preferred) or a real screenshot. Never crops content — the full
// captured frame is always visible (contain-fit), never scaled/cropped past its edges.
export const BrowserFrame: React.FC<{
  src: string;
  kind?: 'image' | 'video';
  delay?: number;
  width?: number | string;
  videoStartFrom?: number; // seconds into the source clip to start playback
  playbackRate?: number;
  loopFrames?: number; // natural clip length in frames — wraps playback in a seamless-ish loop to fill a longer scene
}> = ({ src, kind = 'image', delay = 0, width = '84%', videoStartFrom = 0, playbackRate = 0.85, loopFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const progress = spring({ frame: localFrame, fps, config: { damping: 200, mass: 0.7, stiffness: 110 } });
  const scale = interpolate(progress, [0, 1], [0.97, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        border: `1px solid ${theme.color.surfaceBorder}`,
        boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
        background: theme.color.surface,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          height: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px',
          background: '#0a0b0f',
          borderBottom: `1px solid ${theme.color.surfaceBorder}`,
        }}
      >
        {['#e0607a', '#e8c15a', '#4edea3'].map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: 999, background: c, opacity: 0.85 }} />
        ))}
        <div style={{ marginLeft: 14, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.textMuted }}>
          eventweaver-orpin.vercel.app
        </div>
      </div>
      <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
        {kind === 'video' ? (
          loopFrames ? (
            <Loop durationInFrames={loopFrames}>
              <OffthreadVideo
                src={src}
                startFrom={Math.round(videoStartFrom * fps)}
                playbackRate={playbackRate}
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />
            </Loop>
          ) : (
            <OffthreadVideo
              src={src}
              startFrom={Math.round(videoStartFrom * fps)}
              playbackRate={playbackRate}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          )
        ) : (
          <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        )}
      </div>
    </div>
  );
};
