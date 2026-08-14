import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { type SellerStockStackParamList } from '../../../navigation/types';
import { usePallets } from '../hooks/useSellerStock';
import { STATUS_LABELS, type SellerStockStatus } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<SellerStockStackParamList, 'SellerStockList'>;
}

function statusColor(status: SellerStockStatus): string {
  switch (status) {
    case 'pending_admin_review':
      return '#dc2626';
    case 'ready_for_putaway':
      return '#d97706';
    case 'instructed':
      return '#2563eb';
    case 'put_away':
      return '#16a34a';
  }
}

/** Doc: "Operations Manager ... items automatically move to the Put-Away Pipeline" — this list is that pipeline. */
export function SellerStockListScreen({ navigation }: Props) {
  const role = useAuthStore((state) => state.user?.role);
  const { data: pallets, isPending, error, refetch, isRefetching } = usePallets();

  return (
    <View style={styles.container}>
      {role === 'staff' && (
        <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewPallet')}>
          <Text style={styles.newButtonText}>+ New Pallet</Text>
        </Pressable>
      )}

      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={pallets}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No pallets logged yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('SellerStockDetail', { id: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.index}>{item.palletIndex}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status) }]}>
                <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.summary}>
              {item.sellerName} — box {item.boxNumber} — {item.weightKg}kg
            </Text>
            {item.overweightFlag && <Text style={styles.flag}>⚠ Overweight</Text>}
            {item.condition === 'damaged' && <Text style={styles.flag}>⚠ Damaged</Text>}
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
  index: {
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
