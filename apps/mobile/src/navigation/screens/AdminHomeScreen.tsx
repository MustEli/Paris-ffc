import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../core/auth/authStore';
import { StaffStatusRow } from '../../features/reports/components/StaffStatusRow';
import { StatCard } from '../../features/reports/components/StatCard';
import { useAdminDashboardReport } from '../../features/reports/hooks/useReports';
import { type AdminStackParamList } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;
}


/**
 * Admin's home screen — "whatever happening right now," per the
 * user's explicit request, rather than a plain menu. `liveSummary` is
 * current-state (doesn't reset with the day); `today`/`staff` reset
 * each calendar day — see reports.types.ts (backend) for why both
 * scopes exist side by side. Module access (Reception, Seller Stock,
 * etc.) is now a compact link row rather than the whole screen.
 */
export function AdminHomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data, isPending, error, refetch, isRefetching } = useAdminDashboardReport();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <Text style={styles.eyebrow}>Admin — {user?.name}</Text>
      <Text style={styles.date}>{today}</Text>

      {isPending && <ActivityIndicator style={styles.spinner} />}
      {error && <Text style={styles.error}>{error.message}</Text>}

      {data && (
        <>
          <Text style={styles.sectionTitle}>Right now</Text>
          <View style={styles.statGrid}>
            <StatCard
              label="Staff on shift"
              value={`${data.liveSummary.staffOnShiftCount} / ${data.liveSummary.totalStaffCount}`}
            />
            <StatCard
              label="Pallets pending review"
              value={data.liveSummary.palletsPendingReviewCount}
              tone={data.liveSummary.palletsPendingReviewCount > 0 ? 'warning' : 'default'}
            />
            <StatCard label="Open put-away tasks" value={data.liveSummary.openPutAwayTaskCount} />
            <StatCard label="Active order-prep sessions" value={data.liveSummary.activeOrderPrepSessionCount} />
          </View>

          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.statGrid}>
            <StatCard label="Receptions logged" value={data.today.receptionsLoggedCount} />
            <StatCard label="Receptions completed" value={data.today.receptionsCompletedCount} />
            <StatCard label="Pallets logged" value={data.today.palletsLoggedCount} />
            <StatCard label="Put-away completed" value={data.today.putAwayCompletedCount} />
            <StatCard label="Order-prep sessions started" value={data.today.orderPrepSessionsCreatedCount} />
          </View>

          <Text style={styles.sectionTitle}>Staff</Text>
          {data.staff.length === 0 && <Text style={styles.empty}>No staff accounts yet.</Text>}
          {data.staff.map((staff) => (
            <StaffStatusRow key={staff.userId} staff={staff} />
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Modules</Text>
      <View style={styles.linkRow}>
        <Pressable style={styles.linkChip} onPress={() => navigation.navigate('ReceptionList')}>
          <Text style={styles.linkChipText}>Reception log</Text>
        </Pressable>
        <Pressable style={styles.linkChip} onPress={() => navigation.navigate('SellerStockList')}>
          <Text style={styles.linkChipText}>Seller Stock</Text>
        </Pressable>
        <Pressable style={styles.linkChip} onPress={() => navigation.navigate('PutAwayTaskList')}>
          <Text style={styles.linkChipText}>Put-Away Tasks</Text>
        </Pressable>
        <Pressable style={styles.linkChip} onPress={() => navigation.navigate('OrderPrepSessionList')}>
          <Text style={styles.linkChipText}>Order Prep</Text>
        </Pressable>
        <Pressable style={styles.linkChip} onPress={() => navigation.navigate('UserList')}>
          <Text style={styles.linkChipText}>Users</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  date: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
    marginBottom: 8,
  },
  spinner: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 12,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  linkChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  logoutButton: {
    marginTop: 32,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  logoutText: {
    color: '#0f172a',
    fontWeight: '600',
  },
});
