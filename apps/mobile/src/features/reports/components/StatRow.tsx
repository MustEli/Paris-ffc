import { StyleSheet, Text, View } from 'react-native';

interface StatRowProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}

/**
 * A single label+value line — used inside the Admin dashboard's
 * right-column status panel, which is narrower than a full-width
 * screen (there's a module sidebar to its left), so a stacked list
 * reads better here than StatCard's 2-column grid.
 */
export function StatRow({ label, value, tone = 'default' }: StatRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, tone === 'warning' && styles.valueWarning]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  label: {
    fontSize: 13,
    color: '#475569',
    flexShrink: 1,
    paddingRight: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  valueWarning: {
    color: '#b45309',
  },
});
