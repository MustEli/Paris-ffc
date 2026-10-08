import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../core/theme/colors';
import { useAuthStore } from '../../../core/auth/authStore';
import { type ReceptionStackParamList } from '../../../navigation/types';
import { useReceptions } from '../hooks/useReceptions';
import { CATEGORY_LABELS, type Reception } from '../types';
import { STATUS_LABELS, summarizeDetails } from '../utils';

interface Props {
  navigation: NativeStackNavigationProp<ReceptionStackParamList, 'ReceptionList'>;
  route: RouteProp<ReceptionStackParamList, 'ReceptionList'>;
}

function statusColor(status: Reception['status']): string {
  switch (status) {
    case 'arrived':
      return '#d97706';
    case 'ready_for_putaway':
      return '#2563eb';
    case 'completed':
      return colors.success;
  }
}

/** Doc: "Admin ... view a real-time log of what is received." Staff sees the same log, plus a way to log new deliveries — optionally scoped to one category via the Reception menu's boxes. */
export function ReceptionListScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((state) => state.user?.role);
  const categoryFilter = route.params?.categoryFilter;
  const { data: allReceptions, isPending, error, refetch, isRefetching } = useReceptions();
  const receptions = categoryFilter
    ? allReceptions?.filter((r) => r.details.category === categoryFilter)
    : allReceptions;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{categoryFilter ? CATEGORY_LABELS[categoryFilter] : 'Reception'}</Text>

      {role === 'staff' && (
        <Pressable
          style={styles.newButton}
          onPress={() => navigation.navigate('NewDelivery', { presetCategory: categoryFilter })}
        >
          <Text style={styles.newButtonText}>+ New Delivery</Text>
        </Pressable>
      )}

      {isPending && <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      <FlatList
        data={receptions}
        keyExtractor={(item) => item.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={!isPending ? <Text style={styles.empty}>No deliveries logged yet.</Text> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('ReceptionDetail', { id: item.id })}>
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
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  newButton: {
    margin: 16,
    backgroundColor: colors.brandOrange,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  newButtonText: {
    color: '#1a1200',
    fontWeight: '700',
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.surface,
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
    color: '#f59e0b',
    marginTop: 6,
  },
});
