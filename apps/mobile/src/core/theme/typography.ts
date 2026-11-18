/**
 * Shared type scale — mirrors apps/web-dashboard/src/styles.css's
 * `--text-*`/`--weight-*` tokens (same restraint: one family, two
 * confident weights, not a 400/500/600/700 mix creeping in screen by
 * screen). `fontFamily.sans` is applied app-wide via a global
 * `Text`/`TextInput` defaultProps override once loaded — see
 * App.tsx's `useFonts` call — so most screens never need to reference
 * it directly. `fontFamily.mono` (UI-Docs' mandatory code font) is
 * opt-in per element: apply it to OEM/SKU/bin-location/barcode/
 * tracking-ID style text specifically, not broadly.
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
  /** UI-Docs' bin/shelf-location scale — readable at arm's length. */
  binLocation: 26,
};

export const fontWeight = {
  regular: '500' as const,
  strong: '700' as const,
};

/**
 * Matches the exact weight suffixes @expo-google-fonts ships — regular
 * maps to the font's 500/Medium cut (not 400) and strong to 700/Bold,
 * same two weights `fontWeight` above already names.
 */
export const fontFamily = {
  sans: {
    regular: 'PlusJakartaSans_500Medium',
    strong: 'PlusJakartaSans_700Bold',
  },
  mono: {
    regular: 'JetBrainsMono_500Medium',
    strong: 'JetBrainsMono_700Bold',
  },
};
