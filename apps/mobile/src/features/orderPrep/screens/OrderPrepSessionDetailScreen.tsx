import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStaffUsers } from '../../../core/hooks/useStaffUsers';
import { type OrderPrepStackParamList } from '../../../navigation/types';
import { useAssignOrderPrepTask, useSession } from '../hooks/useOrderPrep';
import { STATUS_LABELS, type OrderPrepTaskRole } from '../types';

interface Props {
  route: RouteProp<OrderPrepStackParamList, 'OrderPrepSessionDetail'>;
  navigation: NativeStackNavigationProp<OrderPrepStackParamList, 'OrderPrepSessionDetail'>;
}

const ROLES: OrderPrepTaskRole[] = ['picker', 'packer'];

/** Admin's view of one session: the calculation, its tasks so far, and a way to assign more. */
export function OrderPrepSessionDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { data: session, isPending, error } = useSession(id);
  const { data: staffUsers } = useStaffUsers();
  const assign = useAssignOrderPrepTask(id);

  const [role, setRole] = useState<OrderPrepTaskRole>('picker');
  const [assignedToUserId, setAssignedToUserId] = useState<string | null>(null);

  if (isPending) return <ActivityIndicator style={styles.spinner} />;
  if (error || !session) {
    return <Text style={styles.error}>{error?.message ?? 'Not found'}</Text>;
  }

  function staffName(userId: string): string {
    return staffUsers?.find((u) => u.id === userId)?.name ?? userId;
  }

  function handleAssign() {
    if (!assignedToUserId) return;
    assign.mutate({ assignedToUserId, role }, { onSuccess: () => setAssignedToUserId(null) });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{session.totalParts} parts</Text>
      <Text style={styles.meta}>Pickers needed: {session.pickersNeeded}</Text>
      <Text style={styles.meta}>Packers needed: {session.packersNeeded}</Text>
      <Text style={styles.meta}>
        Packing starts {session.packingDelayMinutes} min after the first picker starts
      </Text>
      <Text style={styles.meta}>
        {session.pickingStartedAt
          ? `Picking started: ${new Date(session.pickingStartedAt).toLocaleString()}`
          : 'Picking has not started yet'}
      </Text>

      <Text style={styles.sectionTitle}>Tasks</Text>
      {session.tasks.length === 0 && <Text style={styles.empty}>No tasks assigned yet.</Text>}
      {session.tasks.map((task) => (
        <Pressable
          key={task.id}
          style={styles.taskRow}
          onPress={() => navigation.navigate('OrderPrepTaskDetail', { id: task.id })}
        >
          <Text style={styles.taskRole}>{task.role === 'picker' ? 'Picker' : 'Packer'}</Text>
          <Text style={styles.taskAssignee}>{staffName(task.assignedToUserId)}</Text>
          <Text style={styles.taskStatus}>{STATUS_LABELS[task.status]}</Text>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Assign a task</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <Pressable
            key={r}
            style={[styles.chip, role === r && styles.chipSelected]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.chipText, role === r && styles.chipTextSelected]}>
              {r === 'picker' ? 'Picker' : 'Packer'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.staffRow}>
        {staffUsers?.map((user) => (
          <Pressable
            key={user.id}
            style={[styles.chip, assignedToUserId === user.id && styles.chipSelected]}
            onPress={() => setAssignedToUserId(user.id)}
          >
            <Text style={[styles.chipText, assignedToUserId === user.id && styles.chipTextSelected]}>
              {user.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {assign.error && <Text style={styles.error}>{assign.error.message}</Text>}

      <Pressable
        style={[styles.button, (!assignedToUserId || assign.isPending) && styles.buttonDisabled]}
        disabled={!assignedToUserId || assign.isPending}
        onPress={handleAssign}
      >
        {assign.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Assign task</Text>
        )}
      </Pressable>
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  meta: {
    fontSize: 14,
    color: '#374151',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 10,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
  },
  taskRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskRole: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  taskAssignee: {
    fontSize: 13,
    color: '#4b5563',
  },
  taskStatus: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  staffRow: {
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
  button: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
});
