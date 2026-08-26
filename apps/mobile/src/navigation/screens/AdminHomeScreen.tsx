import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../../core/auth/authStore';
import { SegmentedTabs } from '../../features/reports/components/SegmentedTabs';
import { StaffStatusRow } from '../../features/reports/components/StaffStatusRow';
import { StatRow } from '../../features/reports/components/StatRow';
import { useAdminDashboardReport } from '../../features/reports/hooks/useReports';
import { type AdminStackParamList } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'AdminHome'>;
}

type StatusTab = 'current' | 'today' | 'staff';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'today', label: 'Today' },
  { key: 'staff', label: 'Staff' },
];

/**
 * Admin's home screen — "whatever happening right now," per the
 * user's explicit request, laid out as a module sidebar + a tabbed
 * status panel (Current / Today / Staff) rather than stacked sections
 * (an explicit structural revision after the first version shipped).
 * `liveSummary` → "Current" tab (doesn't reset with the day);
 * `today`/`staff` → their own tabs (calendar-day-scoped) — see
 * reports.types.ts (backend) for why both time scopes exist.
 */
export function AdminHomeScreen({ navigation }: Props) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data, isPending, error, refetch, isRefetching } = useAdminDashboardReport();
  const [statusTab, setStatusTab] = useState<StatusTab>('current');

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
        <View style={styles.layout}>
          <View style={styles.sidebar}>
            <Text style={styles.columnTitle}>Modules</Text>
            <Pressable style={styles.moduleCard} onPress={() => navigation.navigate('ReceptionList')}>
              <Text style={styles.moduleLabel}>Reception</Text>
            </Pressable>
            <Pressable style={styles.moduleCard} onPress={() => navigation.navigate('SellerStockList')}>
              <Text style={styles.moduleLabel}>Seller Stock</Text>
            </Pressable>
            <Pressable style={styles.moduleCard} onPress={() => navigation.navigate('PutAwayTaskList')}>
              <Text style={styles.moduleLabel}>Put-Away</Text>
            </Pressable>
            <Pressable style={styles.moduleCard} onPress={() => navigation.navigate('OrderPrepSessionList')}>
              <Text style={styles.moduleLabel}>Order Prep</Text>
            </Pressable>
            <Pressable style={styles.moduleCard} onPress={() => navigation.navigate('UserList')}>
              <Text style={styles.moduleLabel}>Users</Text>
            </Pressable>
          </View>

          <View style={styles.statusColumn}>
            <Text style={styles.columnTitle}>Status</Text>
            <View style={styles.statusCard}>
              <SegmentedTabs tabs={STATUS_TABS} selected={statusTab} onSelect={setStatusTab} />

              <View style={styles.statusContent}>
                {statusTab === 'current' && (
                  <>
                    <StatRow
                      label="Staff on shift"
                      value={`${data.liveSummary.staffOnShiftCount} / ${data.liveSummary.totalStaffCount}`}
                    />
                    <StatRow
                      label="Pallets pending review"
                      value={data.liveSummary.palletsPendingReviewCount}
                      tone={data.liveSummary.palletsPendingReviewCount > 0 ? 'warning' : 'default'}
                    />
                    <StatRow label="Open put-away tasks" value={data.liveSummary.openPutAwayTaskCount} />
                    <StatRow
                      label="Active order-prep sessions"
                      value={data.liveSummary.activeOrderPrepSessionCount}
                    />
                  </>
                )}

                {statusTab === 'today' && (
                  <>
                    <StatRow label="Receptions logged" value={data.today.receptionsLoggedCount} />
                    <StatRow label="Receptions completed" value={data.today.receptionsCompletedCount} />
                    <StatRow label="Pallets logged" value={data.today.palletsLoggedCount} />
                    <StatRow label="Put-away completed" value={data.today.putAwayCompletedCount} />
                    <StatRow
                      label="Order-prep sessions started"
                      value={data.today.orderPrepSessionsCreatedCount}
                    />
                  </>
                )}

                {statusTab === 'staff' && (
                  <>
                    {data.staff.length === 0 && <Text style={styles.empty}>No staff accounts yet.</Text>}
                    {data.staff.map((staff) => (
                      <StaffStatusRow key={staff.userId} staff={staff} />
                    ))}
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

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
    marginBottom: 20,
  },
  spinner: {
    marginTop: 20,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
  layout: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  sidebar: {
    width: 96,
  },
  statusColumn: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  moduleCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    minHeight: 64,
  },
  moduleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  statusCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
  },
  statusContent: {
    marginTop: 14,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
    paddingVertical: 8,
  },
  logoutButton: {
    marginTop: 28,
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
