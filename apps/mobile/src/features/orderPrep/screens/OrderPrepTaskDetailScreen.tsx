import { type RouteProp } from '@react-navigation/native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { type OrderPrepStackParamList } from '../../../navigation/types';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../tasks/priority';
import { useCompleteOrderPrepTask, useOrderPrepTask, useStartOrderPrepTask } from '../hooks/useOrderPrep';
import { STATUS_LABELS } from '../types';

interface Props {
  route: RouteProp<OrderPrepStackParamList, 'OrderPrepTaskDetail'>;
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** Doc's Execution & Data Capture: staff starts/completes their pick or pack task, timestamps recorded automatically. */
export function OrderPrepTaskDetailScreen({ route }: Props) {
  const { id } = route.params;
  const role = useAuthStore((state) => state.user?.role);
  const { data: task, isPending, error } = useOrderPrepTask(id);
  const start = useStartOrderPrepTask(id);
  const complete = useCompleteOrderPrepTask(id);

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !task) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{task.role === 'picker' ? 'Picker task' : 'Packer task'}</Text>
        <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
          <Text style={styles.priorityText}>{PRIORITY_LABELS[task.priority]}</Text>
        </View>
      </View>
      <Text style={styles.status}>{STATUS_LABELS[task.status]}</Text>
      <Text style={styles.meta}>Assigned: {new Date(task.assignedAt).toLocaleString()}</Text>
      {task.startedAt && <Text style={styles.meta}>Started: {new Date(task.startedAt).toLocaleString()}</Text>}
      {task.durationMs !== null && <Text style={styles.meta}>Took {formatDuration(task.durationMs)}</Text>}

      {task.instructions && (
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsLabel}>Instructions</Text>
          <Text style={styles.instructionsText}>{task.instructions}</Text>
        </View>
      )}

      {role === 'staff' && task.status === 'assigned' && (
        <>
          {start.error && <Text style={styles.error}>{start.error.message}</Text>}
          <Pressable style={styles.button} disabled={start.isPending} onPress={() => start.mutate()}>
            {start.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Start task</Text>}
          </Pressable>
        </>
      )}

      {role === 'staff' && task.status === 'in_progress' && (
        <>
          {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
          <Pressable style={styles.button} disabled={complete.isPending} onPress={() => complete.mutate()}>
            {complete.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Task completed</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  spinner: {
    marginTop: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  instructionsBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  instructionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 14,
    color: '#1e293b',
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
    marginTop: 4,
    marginBottom: 14,
  },
  meta: {
    fontSize: 13,
    color: '#374151',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 16,
  },
});
