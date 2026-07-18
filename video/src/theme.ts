// Brand values sourced from README "Design system" section — do not invent new colors.
export const theme = {
  color: {
    bg: '#050608',
    surface: '#0d0f14',
    surfaceBorder: 'rgba(173, 198, 255, 0.14)',
    logicBlueLight: '#adc6ff',
    logicBlue: '#4d8eff',
    adjudicationPurple: '#571bc1',
    emerald: '#4edea3',
    fail: '#e0607a',
    textPrimary: '#f3f5fa',
    textSecondary: '#9aa3b8',
    textMuted: '#5c6478',
  },
  font: {
    display: '"Geist", "Inter", -apple-system, sans-serif',
    body: '"Inter", -apple-system, sans-serif',
    mono: '"JetBrains Mono", "SF Mono", monospace',
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
  },
  motion: {
    entranceFrames: 18,
    exitFrames: 14,
    easeOut: [0.16, 1, 0.3, 1] as [number, number, number, number],
    easeInOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
    cameraPush: 1.06,
    transitionFrames: 16,
  },
} as const;
