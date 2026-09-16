import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface ChipPickerProps {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  isLoading?: boolean;
  /** Shown when `options` is empty and not loading — e.g. "Ask an Admin to add one first." */
  emptyLabel?: string;
}

/**
 * A single-select row of chips for a small, admin-managed list of
 * options (Reception's Transporter Company / Packaging Type, and
 * whatever future admin-managed dropdown needs the same thing) — the
 * same visual pattern this app already used for fixed option sets
 * (category/condition pickers), just backed by a dynamic list instead
 * of a hardcoded one.
 */
export function ChipPicker({ options, value, onChange, isLoading, emptyLabel }: ChipPickerProps) {
  if (isLoading) {
    return <ActivityIndicator style={styles.spinner} />;
  }

  if (options.length === 0) {
    return <Text style={styles.empty}>{emptyLabel ?? 'No options available yet.'}</Text>;
  }

  return (
    <View style={styles.row}>
      {options.map((option) => (
        <Pressable
          key={option}
          style={[styles.chip, value === option && styles.chipSelected]}
          onPress={() => onChange(option)}
        >
          <Text style={[styles.chipText, value === option && styles.chipTextSelected]}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginVertical: 8,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  chipSelected: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
});
