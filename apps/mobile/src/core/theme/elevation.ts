/**
 * Shared shadow/elevation presets — mirrors the spirit of
 * apps/web-dashboard/src/styles.css's `--shadow-*` tokens (real raised-
 * surface depth instead of a flat 1px border doing all the work), bent
 * into React Native's two-system shadow API (iOS's shadow* props +
 * Android's single `elevation` number — both are required together for
 * a consistent look across platforms). Dark background throughout this
 * app, so these read as a soft glow/lift rather than a classic drop
 * shadow — still legible as "this surface is raised."
 */
export const elevation = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
} as const;
