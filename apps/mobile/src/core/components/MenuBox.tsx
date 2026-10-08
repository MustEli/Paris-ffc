import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  description?: string;
  onPress: () => void;
  /** Issue Reporting's red/alert treatment — visually distinct from every other box. */
  variant?: 'default' | 'alert';
  /** Extra top margin — e.g. separating Issue Reporting from the three boxes above it. */
  spacedAbove?: boolean;
}

/** The main menu's and Reception's shared tile — tap it, either do the thing or land on more boxes/rows. */
export function MenuBox({ label, description, onPress, variant = 'default', spacedAbove }: Props) {
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
    padding: 20,
    alignItems: 'center',
  },
  boxAlert: {
    backgroundColor: colors.alertSurface,
    borderColor: colors.alertBorder,
  },
  spacedAbove: {
    marginTop: 28,
  },
  boxPressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  labelAlert: {
    color: colors.alert,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
