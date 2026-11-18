import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
  /** A visibly stronger divider below this row — see Floor Tasks' and Issue Reporting's clustering. */
  strongDividerBelow?: boolean;
  disabled?: boolean;
  /** Optional leading icon in a tinted circle — makes rows scannable at a glance instead of plain text. */
  icon?: LucideIcon;
}

/** Floor Tasks' and Issue Reporting's shared vertical list row, one task/category per row. */
export function ListRow({ label, onPress, strongDividerBelow, disabled, icon: Icon }: Props) {
  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        {Icon && (
          <View style={styles.iconBadge}>
            <Icon size={18} color={colors.brandOrange} />
          </View>
        )}
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        <ChevronRight size={18} color={disabled ? colors.textMuted : colors.textSecondary} />
      </Pressable>
      <View style={strongDividerBelow ? styles.strongDivider : styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.brandOrange + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  labelDisabled: {
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
