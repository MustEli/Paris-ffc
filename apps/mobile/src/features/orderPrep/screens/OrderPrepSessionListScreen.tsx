import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { type OrderPrepStackParamList } from '../../../navigation/types';
import { useSessions } from '../hooks/useOrderPrep';

interface Props {
  navigation: NativeStackNavigationProp<OrderPrepStackParamList, 'OrderPrepSessionList'>;
}

/**
 * Doc's "Labor Optimization Calculator" — Admin creates a session per
 * volume of parts to process. Management also reaches this screen
 * (read-only, from the reporting dashboard) — the create button is
 * admin-only since Management's stack doesn't register
 * NewOrderPrepSession at all.
 */
export function OrderPrepSessionListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const { data: sessions, isPending, error, refetch, isRefetching } = useSessions();

  return (
    <View style={styles.container}>
      {role === 'admin' && (
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewOrderPrepSession')}>
          <Text style={styles.newButtonText}>+ New Session</Text>
        </Pressable>
      )}

      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No sessions yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('OrderPrepSessionDetail', { id: item.id })}
          >
            <Text style={styles.parts}>{item.totalParts} parts</Text>
            <Text style={styles.summary}>
              {item.pickersNeeded} picker(s) · {item.packersNeeded} packer(s) · packing starts +
              {item.packingDelayMinutes}min
            </Text>
            <Text style={styles.status}>
              {item.pickingStartedAt ? 'Picking started' : 'Not started yet'}
            </Text>
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
  newButton: {
    margin: 16,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
  },
  parts: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  summary: {
    fontSize: 13,
    color: '#4b5563',
  },
  status: {
    fontSize: 12,
    color: '#2563eb',
    marginTop: 4,
    fontWeight: '600',
  },
});
