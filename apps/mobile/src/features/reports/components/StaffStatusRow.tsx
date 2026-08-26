import { StyleSheet, Text, View } from 'react-native';

import { type StaffStatus } from '../types';

interface StaffStatusRowProps {
  staff: StaffStatus;
}

function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  return `${hours}h`;
}

/** One row on Admin's "who's doing what right now" roster. */
export function StaffStatusRow({ staff }: StaffStatusRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.name}>{staff.userName}</Text>
        <View style={[styles.pill, staff.onBreak ? styles.pillBreak : staff.onShift ? styles.pillOn : styles.pillOff]}>
          <Text
            style={[
              styles.pillText,
              staff.onBreak ? styles.pillTextBreak : staff.onShift ? styles.pillTextOn : styles.pillTextOff,
            ]}
          >
            {staff.onShift && staff.shiftStartedAt
              ? staff.onBreak
                ? 'On lunch break'
                : `On shift since ${new Date(staff.shiftStartedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
              : 'Off shift'}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        Today: {formatHours(staff.hoursWorkedToday)} worked · {staff.putAwayCompletedToday} put-away ·{' '}
        {staff.orderPrepCompletedToday} order-prep
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillOn: {
    backgroundColor: '#dcfce7',
  },
  pillOff: {
    backgroundColor: '#f1f5f9',
  },
  pillBreak: {
    backgroundColor: '#fef3c7',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  pillTextOn: {
    color: '#166534',
  },
  pillTextOff: {
    color: '#64748b',
  },
  pillTextBreak: {
    color: '#b45309',
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
  },
});
