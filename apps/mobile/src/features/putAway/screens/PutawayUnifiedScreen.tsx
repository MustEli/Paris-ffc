import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { translateError } from '../../../core/i18n/errorCodes';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useMyAssignedReceptions } from '../../reception/hooks/useReceptions';
import { CATEGORY_LABELS } from '../../reception/types';
import { summarizeDetails } from '../../reception/utils';
import { usePallets } from '../../sellerStock/hooks/useSellerStock';
import { useTasks } from '../hooks/usePutAwayTasks';
import { type PutAwayTaskStatus } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'PutawayUnified'>;
}

const OPEN_STATUSES = ['assigned', 'in_progress', 'issue_reported'];

/**
 * A local mapping rather than reusing putAway/types.ts's shared
 * STATUS_LABELS — that constant is also consumed by several screens
 * this pass doesn't translate (PutAwayTaskDetailScreen,
 * PutAwayTaskListScreen), so turning its values into i18n keys would
 * make those render raw key strings instead of text.
 */
const STATUS_LABEL_KEYS: Record<PutAwayTaskStatus, string> = {
  assigned: 'putaway.status.assigned',
  in_progress: 'putaway.status.inProgress',
  completed: 'putaway.status.completed',
  issue_reported: 'putaway.status.issueReported',
};

/**
 * "Putaway" on the new Floor Tasks menu — unifies two previously
 * separate places staff had to check: Admin-assigned Put-Away Tasks,
 * and good-condition pallets they can put away themselves straight
 * from Seller Stock. One list of "everything put-away-able right now."
 */
export function PutawayUnifiedScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tasks = useTasks();
  const pallets = usePallets();
  const assignedReceptions = useMyAssignedReceptions();

  const isPending = tasks.isPending || pallets.isPending || assignedReceptions.isPending;
  const error = tasks.error ?? pallets.error ?? assignedReceptions.error;

  const openTasks = (tasks.data ?? []).filter((t) => OPEN_STATUSES.includes(t.status));
  const readyPallets = (pallets.data ?? []).filter((p) => p.status === 'ready_for_putaway');
  const assignedReceptionsList = assignedReceptions.data ?? [];

  if (isPending) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
    >
      <Text style={styles.title}>{t('putaway.title')}</Text>
      {error && <Text style={styles.error}>{translateError(error, t)}</Text>}

      <Text style={styles.sectionTitle}>{t('putaway.assignedToYou')}</Text>
      {openTasks.length === 0 && assignedReceptionsList.length === 0 && (
        <Text style={styles.empty}>{t('putaway.noAssignedTasks')}</Text>
      )}
      {openTasks.map((task) => (
        <Pressable
          key={task.id}
          style={styles.row}
          onPress={() => navigation.navigate('PutAwayTaskDetail', { id: task.id })}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{task.location}</Text>
            <Text style={styles.rowSubtitle}>{t(STATUS_LABEL_KEYS[task.status])}</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      ))}
      {assignedReceptionsList.map((reception) => (
        <Pressable
          key={reception.id}
          style={styles.row}
          onPress={() => navigation.navigate('ReceptionDetail', { id: reception.id })}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{t(CATEGORY_LABELS[reception.details.category])}</Text>
            <Text style={styles.rowSubtitle}>{summarizeDetails(reception)}</Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
        </Pressable>
      ))}

      <Text style={styles.sectionTitle}>{t('putaway.readyToPutAwayYourself')}</Text>
      {readyPallets.length === 0 && <Text style={styles.empty}>{t('putaway.noReadyPallets')}</Text>}
      {readyPallets.map((pallet) => (
        <Pressable
          key={pallet.id}
          style={styles.row}
          onPress={() => navigation.navigate('SellerStockDetail', { id: pallet.id })}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{t('putaway.pallet', { index: pallet.palletIndex })}</Text>
            <Text style={styles.rowSubtitle}>
              {t('putaway.palletSubtitle', { sellerName: pallet.sellerName, boxNumber: pallet.boxNumber })}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  rowBody: {
    flex: 1,
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
