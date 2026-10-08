import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { usePallets } from '../../sellerStock/hooks/useSellerStock';
import { useTasks } from '../hooks/usePutAwayTasks';
import { STATUS_LABELS } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'PutawayUnified'>;
}

const OPEN_STATUSES = ['assigned', 'in_progress', 'issue_reported'];

/**
 * "Putaway" on the new Floor Tasks menu — unifies two previously
 * separate places staff had to check: Admin-assigned Put-Away Tasks,
 * and good-condition pallets they can put away themselves straight
 * from Seller Stock. One list of "everything put-away-able right now."
 */
export function PutawayUnifiedScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tasks = useTasks();
  const pallets = usePallets();

  const isPending = tasks.isPending || pallets.isPending;
  const error = tasks.error ?? pallets.error;

  const openTasks = (tasks.data ?? []).filter((t) => OPEN_STATUSES.includes(t.status));
  const readyPallets = (pallets.data ?? []).filter((p) => p.status === 'ready_for_putaway');

  if (isPending) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
    >
      <Text style={styles.title}>Putaway</Text>
      {error && <Text style={styles.error}>{error.message}</Text>}

      <Text style={styles.sectionTitle}>Assigned to you</Text>
      {openTasks.length === 0 && <Text style={styles.empty}>No assigned put-away tasks.</Text>}
      {openTasks.map((task) => (
        <Pressable
          key={task.id}
          style={styles.row}
          onPress={() => navigation.navigate('PutAwayTaskDetail', { id: task.id })}
        >
          <Text style={styles.rowTitle}>{task.location}</Text>
          <Text style={styles.rowSubtitle}>{STATUS_LABELS[task.status]}</Text>
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>Ready to put away yourself</Text>
      {readyPallets.length === 0 && <Text style={styles.empty}>No pallets ready for self put-away.</Text>}
      {readyPallets.map((pallet) => (
        <Pressable
          key={pallet.id}
          style={styles.row}
          onPress={() => navigation.navigate('SellerStockDetail', { id: pallet.id })}
        >
          <Text style={styles.rowTitle}>Pallet {pallet.palletIndex}</Text>
          <Text style={styles.rowSubtitle}>
            {pallet.sellerName} · Box {pallet.boxNumber}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  spinner: {
    flex: 1,
    marginTop: 40,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 10,
  },
  empty: {
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginBottom: 12,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
