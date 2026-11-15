import { StyleSheet, Text, View } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}

/** A single at-a-glance number — the "operational progress" snapshot at the top of the dashboard. */
export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <View style={[styles.card, tone === 'warning' && styles.cardWarning]}>
      <Text style={[styles.value, tone === 'warning' && styles.valueWarning]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
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
