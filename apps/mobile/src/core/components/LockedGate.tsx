import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  /** Shown above the button — e.g. "Ready when you are" / "On break". */
  title: string;
  subtitle?: string;
  buttonLabel: string;
  onPress: () => void;
  isBusy?: boolean;
  /** Secondary, less prominent action below the main button — e.g. "Log out" while off-shift. */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
}

/**
 * The one sole active element on screen while off-shift or on break —
 * everything else sits behind this as an inert backdrop. Deliberately
 * a plain dark scrim rather than a real blur (expo-blur would be a new
 * native dependency for a mostly-cosmetic effect); the dimming plus the
 * one bright orange button already reads as "this is the one thing to
 * do right now" without it.
 */
export function LockedGate({ title, subtitle, buttonLabel, onPress, isBusy, secondaryLabel, onSecondaryPress }: Props) {
  return (
    <View style={styles.scrim}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isBusy && styles.buttonBusy]}
          onPress={onPress}
          disabled={isBusy}
        >
          {isBusy ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
        </Pressable>

        {secondaryLabel && onSecondaryPress && (
          <Pressable style={styles.secondaryButton} onPress={onSecondaryPress}>
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 36,
  },
  button: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 999,
    alignItems: 'center',
    minWidth: 220,
    shadowColor: colors.brandOrange,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#1a1200',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
