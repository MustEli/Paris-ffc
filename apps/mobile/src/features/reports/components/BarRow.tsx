import { StyleSheet, Text, View } from 'react-native';

interface BarRowProps {
  label: string;
  value: number;
  /** The value that represents a "full" bar — usually the max across the sibling rows. */
  maxValue: number;
  displayValue: string;
  color?: string;
}

/**
 * A labeled, proportional-width bar — the simplest possible "visual
 * analytics dashboard" (Feature 0's Management requirement) without
 * pulling in a charting library. Plain Views sized by percentage are
 * enough to give an at-a-glance comparison and avoid a new dependency
 * that might not play well with Expo Go.
 */
export function BarRow({ label, value, maxValue, displayValue, color = '#2563eb' }: BarRowProps) {
  const widthPercent = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{displayValue}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${widthPercent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    color: '#6b7280',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
