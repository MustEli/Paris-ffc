import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type StaffStackParamList } from '../../../navigation/types';
import { useTasks } from '../../putAway/hooks/usePutAwayTasks';
import { STATUS_LABELS as PUT_AWAY_STATUS_LABELS, type PutAwayTask, type PutAwayTaskStatus } from '../../putAway/types';
import { useOrderPrepTasks } from '../../orderPrep/hooks/useOrderPrep';
import { STATUS_LABELS as ORDER_PREP_STATUS_LABELS, type OrderPrepTask, type OrderPrepTaskStatus } from '../../orderPrep/types';
import { PRIORITY_COLORS, PRIORITY_LABELS, priorityRank } from '../priority';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'MyTasks'>;
}

type MergedTask = { type: 'put_away'; task: PutAwayTask } | { type: 'order_prep'; task: OrderPrepTask };

function statusColor(status: PutAwayTaskStatus | OrderPrepTaskStatus): string {
  switch (status) {
    case 'assigned':
      return '#d97706';
    case 'in_progress':
      return '#2563eb';
    case 'issue_reported':
      return '#dc2626';
    case 'completed':
      return '#16a34a';
  }
}

/**
 * Merges Put-Away and Order-Prep tasks into the single "My Tasks" list
 * the feedback asked for (was two separate menu entries) — same
 * underlying data/actions, this just presents them together, sorted by
 * priority then most-recently-assigned. Tapping a row still opens the
 * existing type-specific detail screen (PutAwayTaskDetail /
 * OrderPrepTaskDetail) — nothing about start/complete/report-issue
 * changed, only how tasks are found.
 */
export function MyTasksScreen({ navigation }: Props) {
  const putAway = useTasks();
  const orderPrep = useOrderPrepTasks();

  const isPending = putAway.isPending || orderPrep.isPending;
  const error = putAway.error ?? orderPrep.error;
  const isRefetching = putAway.isRefetching || orderPrep.isRefetching;

  function refetch() {
    putAway.refetch();
    orderPrep.refetch();
  }

  const merged: MergedTask[] = [
    ...(putAway.data ?? []).map((task): MergedTask => ({ type: 'put_away', task })),
    ...(orderPrep.data ?? []).map((task): MergedTask => ({ type: 'order_prep', task })),
  ].sort((a, b) => {
    const rankDiff = priorityRank(b.task.priority) - priorityRank(a.task.priority);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.task.assignedAt).getTime() - new Date(a.task.assignedAt).getTime();
  });

  return (
    <View style={styles.container}>
      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={merged}
        keyExtractor={(item) => `${item.type}:${item.task.id}`}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No tasks assigned yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              item.type === 'put_away'
                ? navigation.navigate('PutAwayTaskDetail', { id: item.task.id })
                : navigation.navigate('OrderPrepTaskDetail', { id: item.task.id })
            }
          >
            <View style={styles.rowHeader}>
              <Text style={styles.title}>
                {item.type === 'put_away' ? item.task.location : item.task.role === 'picker' ? 'Picker' : 'Packer'}
              </Text>
              <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[item.task.priority] }]}>
                <Text style={styles.pillText}>{PRIORITY_LABELS[item.task.priority]}</Text>
              </View>
            </View>
            <View style={styles.rowFooter}>
              <Text style={styles.typeLabel}>{item.type === 'put_away' ? 'Put-Away' : 'Order Prep'}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(item.task.status) }]}>
                <Text style={styles.pillText}>
                  {item.type === 'put_away'
                    ? PUT_AWAY_STATUS_LABELS[item.task.status]
                    : ORDER_PREP_STATUS_LABELS[item.task.status]}
                </Text>
              </View>
            </View>
            {item.task.instructions && <Text style={styles.instructions}>{item.task.instructions}</Text>}
            {item.type === 'put_away' && item.task.issueDescription && (
              <Text style={styles.flag}>⚠ {item.task.issueDescription}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  spinner: {
    marginTop: 24,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 16,
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 40,
  },
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  typeLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  instructions: {
    fontSize: 13,
    color: '#374151',
    marginTop: 6,
  },
  flag: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 4,
  },
});
