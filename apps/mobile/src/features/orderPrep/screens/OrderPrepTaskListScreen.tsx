import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { type OrderPrepStackParamList } from '../../../navigation/types';
import { useOrderPrepTasks } from '../hooks/useOrderPrep';
import { STATUS_LABELS, type OrderPrepTaskStatus } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<OrderPrepStackParamList, 'OrderPrepTaskList'>;
}

function statusColor(status: OrderPrepTaskStatus): string {
  switch (status) {
    case 'assigned':
      return '#d97706';
    case 'in_progress':
      return '#2563eb';
    case 'completed':
      return '#16a34a';
  }
}

export function OrderPrepTaskListScreen({ navigation }: Props) {
  const { data: tasks, isPending, error, refetch, isRefetching } = useOrderPrepTasks();

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
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No order prep tasks yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('OrderPrepTaskDetail', { id: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.role}>{item.role === 'picker' ? 'Picker' : 'Packer'}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
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
  },
  role: {
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
});
