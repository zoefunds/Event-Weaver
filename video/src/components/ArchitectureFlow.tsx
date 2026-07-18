import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

const NODE_W = 210;

const Node: React.FC<{ label: string; sub?: string; appearAt: number; frame: number; accent?: string }> = ({
  label,
  sub,
  appearAt,
  frame,
  accent = theme.color.logicBlue,
}) => {
  const local = frame - appearAt;
  const opacity = interpolate(local, [0, 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = interpolate(local, [0, 14], [0.9, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        width: NODE_W,
        opacity,
        transform: `scale(${scale})`,
        border: `1.5px solid ${accent}`,
        borderRadius: theme.radius.sm,
        background: 'rgba(13,15,20,0.9)',
        padding: '14px 16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontFamily: theme.font.display, fontSize: 18, fontWeight: 700, color: theme.color.textPrimary }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.textMuted, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
};

// Causal path: evidence URL -> N independent validator fetches -> reasoning -> consensus -> verdict.
export const ArchitectureFlow: React.FC<{ delay?: number; validators?: number }> = ({
  delay = 0,
  validators = 3,
}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - delay);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
      <Node label="Evidence URL" sub="rendered inside GenVM" appearAt={0} frame={t} />
      <div style={{ fontSize: 22, color: theme.color.textMuted }}>↓</div>
      <div style={{ display: 'flex', gap: 22 }}>
        {Array.from({ length: validators }).map((_, i) => (
          <Node
            key={i}
            label={`Validator ${i + 1}`}
            sub="independent fetch + reasoning"
            appearAt={12 + i * 10}
            frame={t}
            accent={theme.color.adjudicationPurple}
          />
        ))}
      </div>
      <div style={{ fontSize: 22, color: theme.color.textMuted }}>↓</div>
      <Node
        label="prompt_comparative"
        sub="agree on outcome, not wording"
        appearAt={60}
        frame={t}
        accent={theme.color.logicBlue}
      />
      <div style={{ fontSize: 22, color: theme.color.textMuted }}>↓</div>
      <Node label="Verdict written on-chain" sub="reasoning persisted, auditable" appearAt={80} frame={t} accent={theme.color.emerald} />
    </div>
  );
};
