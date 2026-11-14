/**
 * Shared type scale — mirrors apps/web-dashboard/src/styles.css's
 * `--text-*`/`--weight-*` tokens (same restraint: one family, two
 * confident weights, not a 400/500/600/700 mix creeping in screen by
 * screen). Font family itself stays the RN/Expo default everywhere —
 * no custom font loaded in this app, so there's nothing to centralize
 * there.
 */
export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 22,
  /** The one deliberately large size — a screen's single hero title (e.g. Sign in). */
  display: 28,
};

export const fontWeight = {
  regular: '500' as const,
  strong: '700' as const,
};
