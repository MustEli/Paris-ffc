import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  /** A visibly stronger divider below this row — see Floor Tasks' and Issue Reporting's clustering. */
  strongDividerBelow?: boolean;
  disabled?: boolean;
}

/** Floor Tasks' and Issue Reporting's shared vertical list row, one task/category per row. */
export function ListRow({ label, onPress, strongDividerBelow, disabled }: Props) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        <Text style={[styles.chevron, disabled && styles.labelDisabled]}>›</Text>
      </Pressable>
      <View style={strongDividerBelow ? styles.strongDivider : styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  rowPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 20,
    color: colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 20,
  },
  strongDivider: {
    height: 8,
    backgroundColor: colors.background,
  },
});
