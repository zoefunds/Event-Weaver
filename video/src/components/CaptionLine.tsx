import React from 'react';
import { theme } from '../theme';

export const CaptionLine: React.FC<{ text: string; visible: boolean }> = ({ text, visible }) => {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '9%',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: '78%',
        textAlign: 'center',
        fontFamily: theme.font.body,
        fontSize: 30,
        fontWeight: 500,
        color: theme.color.textPrimary,
        background: 'rgba(5, 6, 8, 0.55)',
        padding: '10px 22px',
        borderRadius: theme.radius.sm,
        lineHeight: 1.35,
      }}
    >
      {text}
    </div>
  );
};
