import { StyleSheet, Text, View } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}

/** A single at-a-glance number — the "operational progress" snapshot at the top of the dashboard. */
export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, tone === 'warning' && styles.valueWarning]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  valueWarning: {
    color: '#b45309',
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});
