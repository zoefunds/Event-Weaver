import React from 'react';

// Keeps content clear of platform-UI crop zones across 16:9 / 9:16 / 1:1.
export const SafeArea: React.FC<{
  format: 'landscape' | 'vertical' | 'square';
  children: React.ReactNode;
}> = ({ format, children }) => {
  const padding =
    format === 'landscape'
      ? '6% 9%'
      : format === 'vertical'
        ? '11% 7%'
        : '8% 8%';
  return (
    <div style={{ position: 'absolute', inset: 0, padding, boxSizing: 'border-box' }}>
      {children}
    </div>
  );
};
