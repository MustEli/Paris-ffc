import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS } from '../../reception/types';
import { BarRow } from '../components/BarRow';
import { StatCard } from '../components/StatCard';
import {
  useAttendanceReport,
  useOrderPrepReport,
  useOverviewReport,
  usePutAwayReport,
  useReceptionReport,
} from '../hooks/useReports';

function minutesLabel(minutes: number | null): string {
  if (minutes === null) return 'no data yet';
  if (minutes < 60) return `${minutes} min avg`;
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m avg`;
}

/**
 * Feature 0's Management interface: "Reporting tools and visual
 * analytics dashboards" / "Management dashboards aggregate this data to
 * visualize advancement and efficiency metrics." Every number here
 * comes from packages/backend/src/reports — data other features were
 * already recording, just never surfaced anywhere until now.
 */
export function DashboardScreen() {
  const overview = useOverviewReport();
  const attendance = useAttendanceReport();
  const reception = useReceptionReport();
  const putAway = usePutAwayReport();
  const orderPrep = useOrderPrepReport();

  const isRefreshing =
    overview.isRefetching || attendance.isRefetching || reception.isRefetching || putAway.isRefetching || orderPrep.isRefetching;

  function refreshAll() {
    overview.refetch();
    attendance.refetch();
    reception.refetch();
    putAway.refetch();
    orderPrep.refetch();
  }

  const anyPending = overview.isPending || attendance.isPending || reception.isPending || putAway.isPending || orderPrep.isPending;

  if (anyPending) {
    return <ActivityIndicator style={styles.spinner} />;
  }

  const maxAttendanceHours = Math.max(1, ...(attendance.data?.rows.map((r) => r.totalHoursWorked) ?? [0]));
  const maxReceptionMinutes = Math.max(
    1,
    ...(reception.data?.categories.map((c) => c.averageProcessingMinutes ?? 0) ?? [0]),
  );
  const maxOrderPrepMinutes = Math.max(
    1,
    orderPrep.data?.pickerTasks.averageDurationMinutes ?? 0,
    orderPrep.data?.packerTasks.averageDurationMinutes ?? 0,
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />}
    >
      <Text style={styles.sectionTitle}>Right now</Text>
      {overview.error && <Text style={styles.error}>{overview.error.message}</Text>}
      {overview.data && (
        <View style={styles.statGrid}>
          <StatCard label="Staff on shift" value={`${overview.data.staffOnShiftCount} / ${overview.data.totalStaffCount}`} />
          <StatCard
            label="Pallets pending review"
            value={overview.data.palletsPendingReviewCount}
            tone={overview.data.palletsPendingReviewCount > 0 ? 'warning' : 'default'}
          />
          <StatCard label="Open put-away tasks" value={overview.data.openPutAwayTaskCount} />
          <StatCard label="Active order-prep sessions" value={overview.data.activeOrderPrepSessionCount} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Attendance — total hours worked</Text>
      {attendance.error && <Text style={styles.error}>{attendance.error.message}</Text>}
      {attendance.data && attendance.data.rows.length === 0 && (
        <Text style={styles.empty}>No completed shifts yet.</Text>
      )}
      {attendance.data?.rows.map((row) => (
        <BarRow
          key={row.userId}
          label={row.userName}
          value={row.totalHoursWorked}
          maxValue={maxAttendanceHours}
          displayValue={`${row.totalHoursWorked}h · ${row.totalShifts} shift${row.totalShifts === 1 ? '' : 's'}`}
        />
      ))}

      <Text style={styles.sectionTitle}>Reception — average processing time</Text>
      {reception.error && <Text style={styles.error}>{reception.error.message}</Text>}
      {reception.data?.categories.map((category) => (
        <BarRow
          key={category.category}
          label={CATEGORY_LABELS[category.category]}
          value={category.averageProcessingMinutes ?? 0}
          maxValue={maxReceptionMinutes}
          color={category.flaggedCount > 0 ? '#d97706' : '#2563eb'}
          displayValue={
            category.completedCount === 0
              ? `${category.totalCount} logged, none completed yet`
              : `${minutesLabel(category.averageProcessingMinutes)} (${category.completedCount} completed)` +
                (category.flaggedCount > 0 ? ` · ${category.flaggedCount} flagged` : '')
          }
        />
      ))}

      <Text style={styles.sectionTitle}>Put-Away</Text>
      {putAway.error && <Text style={styles.error}>{putAway.error.message}</Text>}
      {putAway.data && (
        <View style={styles.statGrid}>
          <StatCard label="Completed" value={putAway.data.completedCount} />
          <StatCard
            label="Issues reported"
            value={putAway.data.issueReportedCount}
            tone={putAway.data.issueReportedCount > 0 ? 'warning' : 'default'}
          />
          <StatCard label="Total tasks" value={putAway.data.totalTasks} />
          <StatCard label="Avg completion" value={minutesLabel(putAway.data.averageCompletionMinutes)} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Order Prep — average task duration</Text>
      {orderPrep.error && <Text style={styles.error}>{orderPrep.error.message}</Text>}
      {orderPrep.data && (
        <>
          <Text style={styles.meta}>{orderPrep.data.totalSessions} session(s) total</Text>
          <BarRow
            label="Pickers"
            value={orderPrep.data.pickerTasks.averageDurationMinutes ?? 0}
            maxValue={maxOrderPrepMinutes}
            displayValue={
              orderPrep.data.pickerTasks.completedCount === 0
                ? `${orderPrep.data.pickerTasks.totalCount} assigned, none completed yet`
                : `${minutesLabel(orderPrep.data.pickerTasks.averageDurationMinutes)} (${orderPrep.data.pickerTasks.completedCount} completed)`
            }
          />
          <BarRow
            label="Packers"
            value={orderPrep.data.packerTasks.averageDurationMinutes ?? 0}
            maxValue={maxOrderPrepMinutes}
            color="#16a34a"
            displayValue={
              orderPrep.data.packerTasks.completedCount === 0
                ? `${orderPrep.data.packerTasks.totalCount} assigned, none completed yet`
                : `${minutesLabel(orderPrep.data.packerTasks.averageDurationMinutes)} (${orderPrep.data.packerTasks.completedCount} completed)`
            }
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  spinner: {
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  meta: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 10,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginBottom: 8,
  },
});
