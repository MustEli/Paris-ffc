import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { colors } from '../../../core/theme/colors';
import { elevation } from '../../../core/theme/elevation';
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
          <Plus size={18} color="#1a1200" />
          <Text style={styles.newButtonText}>New Pallet</Text>
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
    backgroundColor: colors.background,
  },
  newButton: {
    flexDirection: 'row',
    gap: 6,
    margin: 16,
    backgroundColor: colors.brandOrange,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButtonText: {
    color: '#1a1200',
    fontWeight: '600',
  },
  spinner: {
    marginTop: 24,
  },
  error: {
    color: colors.alert,
    textAlign: 'center',
    marginTop: 16,
  },
  empty: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 40,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    ...elevation.sm,
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
    color: colors.textPrimary,
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
    color: colors.textSecondary,
  },
  flag: {
    fontSize: 12,
    color: colors.brandOrange,
    marginTop: 4,
    fontWeight: '600',
  },
});
