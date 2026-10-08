/**
 * Staff-view redesign's dark theme — mobile-only (Admin/Management stay
 * on the existing light theme; this is a deliberately different
 * product feel for the handheld floor tool vs. the desk dashboard).
 * `brandOrange` is the exact value already used as `--brand-orange` in
 * apps/web-dashboard/src/styles.css, kept identical so the one accent
 * color that crosses both products matches exactly.
 */
export const colors = {
  background: '#0b0f17',
  surface: '#141b26',
  surfaceElevated: '#1c2533',
  border: '#2a3545',

  textPrimary: '#f8fafc',
  textSecondary: '#9aa7b8',
  textMuted: '#64748a',

  brandOrange: '#fd8c1e',
  brandBlue: '#1e3a8a',
  brandRed: '#b91c1c',

  alert: '#ef4444',
  alertSurface: '#2a1316',
  alertBorder: '#5c2328',

  success: '#22c55e',

  /** LockedGate's backdrop over whatever's behind it — a plain dark scrim rather than a real blur (no new native dependency for a mostly-cosmetic effect). */
  scrim: 'rgba(5,8,13,0.86)',
};
