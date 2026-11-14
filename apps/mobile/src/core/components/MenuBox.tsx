import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

interface Props {
  label: string;
  description?: string;
  onPress: () => void;
  /** Issue Reporting's red/alert treatment — visually distinct from every other box. */
  variant?: 'default' | 'alert';
  /** Extra top margin — e.g. separating Issue Reporting from the three boxes above it. */
  spacedAbove?: boolean;
  /** A small count pill in the top-right corner — e.g. Open Pool Tasks' current unclaimed count. Hidden entirely at 0/undefined. */
  badgeCount?: number;
}

/** The main menu's and Reception's shared tile — tap it, either do the thing or land on more boxes/rows. */
export function MenuBox({ label, description, onPress, variant = 'default', spacedAbove, badgeCount }: Props) {
  const isAlert = variant === 'alert';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.box,
        isAlert && styles.boxAlert,
        spacedAbove && styles.spacedAbove,
        pressed && styles.boxPressed,
      ]}
      onPress={onPress}
    >
      {!!badgeCount && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
      <Text style={[styles.label, isAlert && styles.labelAlert]}>{label}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing[5],
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: spacing[4],
    backgroundColor: colors.brandOrange,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#1a1200',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.strong,
  },
  boxAlert: {
    backgroundColor: colors.alertSurface,
    borderColor: colors.alertBorder,
  },
  spacedAbove: {
    marginTop: spacing[8],
  },
  boxPressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.strong,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  labelAlert: {
    color: colors.alert,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing[1],
    textAlign: 'center',
  },
});
