import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { type ReceptionStackParamList } from '../../../navigation/types';
import { useReceptions } from '../hooks/useReceptions';
import { CATEGORY_LABELS, type Reception } from '../types';
import { STATUS_LABELS, summarizeDetails } from '../utils';

interface Props {
  navigation: NativeStackNavigationProp<ReceptionStackParamList, 'ReceptionList'>;
}

function statusColor(status: Reception['status']): string {
  switch (status) {
    case 'arrived':
      return '#d97706';
    case 'ready_for_putaway':
      return '#2563eb';
    case 'completed':
      return '#16a34a';
  }
}

/** Doc: "Admin ... view a real-time log of what is received." Staff sees the same log, plus a way to log new deliveries. */
export function ReceptionListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const { data: receptions, isPending, error, refetch, isRefetching } = useReceptions();

  return (
    <View style={styles.container}>
      {role === 'staff' && (
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewDelivery')}>
          <Text style={styles.newButtonText}>+ New Delivery</Text>
        </Pressable>
      )}

      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={receptions}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No receptions logged yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('ReceptionDetail', { id: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.category}>{CATEGORY_LABELS[item.details.category]}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.summary}>{summarizeDetails(item)}</Text>
            {item.flaggedForReview && <Text style={styles.flag}>⚠ Flagged for review (over 2h)</Text>}
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
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  category: {
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
    marginTop: 6,
  },
});
