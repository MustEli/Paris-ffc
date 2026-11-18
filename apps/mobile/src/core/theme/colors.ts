/**
 * Staff-view redesign's dark theme — mobile-only (Admin/Management stay
 * on the existing light theme; this is a deliberately different
 * product feel for the handheld floor tool vs. the desk dashboard).
 * `brandOrange`/`brandOrangeHover`/`brandOrangeTint` are the exact
 * values from the UI-Docs design tokens (elno-design-tokens.json /
 * elno-variables.css) — `--brand-primary` / `--brand-primary-hover` /
 * `--brand-primary-tint` there, and the same `--brand-orange` value in
 * apps/web-dashboard/src/styles.css — kept identical so the one accent
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

  brandOrange: '#FF5A00',
  brandOrangeHover: '#E04E00',
  brandOrangeTint: 'rgba(255, 90, 0, 0.14)',
  brandBlue: '#1e3a8a',
  brandRed: '#b91c1c',

  /** The 3-segment French micro-accent — login card top strip only, see UI-Docs. */
  frBlue: '#002654',
  frWhite: '#FFFFFF',
  frRed: '#ED2939',

  /** UI-Docs `--status-error`. */
  alert: '#DC2626',
  alertSurface: '#2a1316',
  alertBorder: '#5c2328',

  /** UI-Docs `--status-success`. */
  success: '#16A34A',
  /** UI-Docs `--status-warning`. */
  warning: '#D97706',

  /** LockedGate's backdrop over whatever's behind it — a plain dark scrim rather than a real blur (no new native dependency for a mostly-cosmetic effect). */
  scrim: 'rgba(5,8,13,0.86)',
};
