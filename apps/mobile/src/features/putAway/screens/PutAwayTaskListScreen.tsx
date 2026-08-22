import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type PutAwayStackParamList } from '../../../navigation/types';
import { useTasks } from '../hooks/usePutAwayTasks';
import { STATUS_LABELS, type PutAwayTaskStatus } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<PutAwayStackParamList, 'PutAwayTaskList'>;
}

function statusColor(status: PutAwayTaskStatus): string {
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

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Staff see only their own tasks (server-filtered); Admin sees all — same list, different data. */
export function PutAwayTaskListScreen({ navigation }: Props) {
  const { data: tasks, isPending, error, refetch, isRefetching } = useTasks();

  return (
    <View style={styles.container}>
      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No put-away tasks yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('PutAwayTaskDetail', { id: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.location}>{item.location}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            {item.durationMs !== null && (
              <Text style={styles.summary}>Took {formatDuration(item.durationMs)}</Text>
            )}
            {item.issueDescription && <Text style={styles.flag}>⚠ {item.issueDescription}</Text>}
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
  location: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  summary: {
    fontSize: 13,
    color: '#4b5563',
  },
  flag: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 4,
  },
});
