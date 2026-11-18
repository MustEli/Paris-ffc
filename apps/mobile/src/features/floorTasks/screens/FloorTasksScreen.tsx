import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Archive,
  ArrowUpDown,
  ChevronRight,
  CircleEllipsis,
  CirclePause,
  ClipboardList,
  Download,
  type LucideIcon,
  Package,
  Send,
  ShoppingBasket,
  Trash2,
  Undo2,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '../../../core/components/ListRow';
import { translateError } from '../../../core/i18n/errorCodes';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useOrderPrepTasks } from '../../orderPrep/hooks/useOrderPrep';
import { useMyOpenFloorTasks, useResumeFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META, type FloorTaskCategory, type FloorTaskLog } from '../types';
import { FloorTaskDetailScreen } from './FloorTaskDetailScreen';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTasks'>;
}

const OPEN_ORDER_PREP_STATUSES = ['assigned', 'in_progress'];

const CATEGORY_ICON: Record<FloorTaskCategory, LucideIcon> = {
  pick: ShoppingBasket,
  pack: Package,
  dispatch: Send,
  return_processing: Undo2,
  warehousing_inventory_check: ClipboardList,
  warehousing_location_adjustment: ArrowUpDown,
  box_prep: Archive,
  backup_box: Archive,
  backup_shredder: Trash2,
  backup_other: CircleEllipsis,
};

/** "3h 20m ago" / "12m ago" — used for how long a parked task has been paused. */
function formatAgo(iso: string): string {
  const totalMinutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * A compact row for one parked (paused) floor task — tapping it resumes
 * the task and opens its detail page in the same action, so staff never
 * land on a still-paused screen they then have to press Resume on.
 */
function ParkedTaskRow({
  task,
  navigation,
}: {
  task: FloorTaskLog;
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTasks'>;
}) {
  const { t } = useTranslation();
  const meta = CATEGORY_META.find((m) => m.category === task.category);
  const resume = useResumeFloorTask(task.id);
  // Re-renders every minute so "X ago" doesn't go stale while this screen stays open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  function handlePress() {
    resume.mutate();
    navigation.navigate('FloorTaskDetail', { category: task.category });
  }

  return (
    <Pressable style={styles.parkedRow} onPress={handlePress}>
      <CirclePause size={22} color={colors.brandOrange} />
      <View style={styles.parkedRowText}>
        <Text style={styles.parkedRowLabel}>{meta ? t(meta.label) : task.category}</Text>
        <Text style={styles.parkedRowMeta}>{t('floorTasks.pausedFor', { time: formatAgo(task.pausedAt!) })}</Text>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * Staff-view redesign's Floor Tasks menu: a vertical list clustered
 * [Pick, Pack] / [Return Processing] / [Putaway] / [Inventory Check,
 * Location Adjustment] / [Backup x3]. Tapping a category opens its one
 * combined page (see FloorTaskDetailScreen) — Start/Pause/Stop/Cancel
 * all live there, nothing is created just by opening it.
 *
 * A staff member can have more than one task open now (one running +
 * up to FLOOR_TASK_MAX_PAUSED paused — see FloorTasksService), so this
 * screen only force-redirects straight to the detail page when
 * something is actively *running* (that's the only case where picking
 * a different category would just dead-end anyway, backend-enforced).
 * Any merely-paused tasks are surfaced instead as a compact list above
 * the category menu, so they're never out of sight while still letting
 * a new category be started. Admin-assigned Order-Prep picker/packer
 * work is a separate system (deliberately not merged with self-serve
 * Pick/Pack here — see this project's history); the banner below just
 * keeps it reachable now that "My Tasks" is gone as its own menu entry.
 */
export function FloorTasksScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: openTasksData, isPending, error } = useMyOpenFloorTasks();
  const openTasks = openTasksData ?? [];
  const activeTask = openTasks.find((task) => !task.pausedAt);
  const pausedTasks = openTasks.filter((task) => task.pausedAt);
  const orderPrep = useOrderPrepTasks();
  const openOrderPrepTask = (orderPrep.data ?? []).find((t) => OPEN_ORDER_PREP_STATUSES.includes(t.status));

  if (isPending) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  // Something's actively running — render its page directly, in place,
  // rather than asking React Navigation to transition to a new route
  // for it. A `navigation.replace()` call from inside a useEffect here
  // previously left the screen stuck on this very spinner indefinitely
  // in some cases (never actually resolved to the detail screen) —
  // plain React composition can't get stuck waiting on a navigation
  // transition, because there isn't one. A merely-paused task does NOT
  // force this — see the parked-tasks list below instead.
  if (activeTask) {
    const inlineRoute = {
      key: 'floor-task-detail-inline',
      name: 'FloorTaskDetail' as const,
      params: { category: activeTask.category },
    } satisfies RouteProp<StaffStackParamList, 'FloorTaskDetail'>;
    return (
      <FloorTaskDetailScreen
        navigation={navigation as unknown as NativeStackNavigationProp<StaffStackParamList, 'FloorTaskDetail'>}
        route={inlineRoute}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>{t('floorTasks.title')}</Text>
      {error && <Text style={styles.error}>{translateError(error, t)}</Text>}

      {pausedTasks.length > 0 && (
        <View style={styles.parkedSection}>
          <Text style={styles.parkedSectionHeader}>{t('floorTasks.unfinishedTasksHeader')}</Text>
          {pausedTasks.map((task) => (
            <ParkedTaskRow key={task.id} task={task} navigation={navigation} />
          ))}
        </View>
      )}

      {openOrderPrepTask && (
        <Pressable
          style={styles.orderPrepBanner}
          onPress={() => navigation.navigate('OrderPrepTaskDetail', { id: openOrderPrepTask.id })}
        >
          <Text style={styles.orderPrepBannerText}>
            {t('floorTasks.assignedOrderPrepBanner', {
              role: openOrderPrepTask.role === 'picker' ? t('floorTasks.picker') : t('floorTasks.packer'),
            })}
          </Text>
        </Pressable>
      )}

      {CATEGORY_META.slice(0, 3).map((meta) => (
        <ListRow
          key={meta.category}
          label={t(meta.label)}
          icon={CATEGORY_ICON[meta.category]}
          strongDividerBelow={meta.strongDividerBelow}
          onPress={() => navigation.navigate('FloorTaskDetail', { category: meta.category })}
        />
      ))}

      <ListRow
        label={t('floorTasks.putaway')}
        icon={Download}
        strongDividerBelow
        onPress={() => navigation.navigate('PutawayUnified')}
      />

      {CATEGORY_META.slice(3).map((meta) => (
        <ListRow
          key={meta.category}
          label={t(meta.label)}
          icon={CATEGORY_ICON[meta.category]}
          strongDividerBelow={meta.strongDividerBelow}
          onPress={() => navigation.navigate('FloorTaskDetail', { category: meta.category })}
        />
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
    paddingBottom: 32,
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
    padding: 20,
    paddingBottom: 4,
  },
  parkedSection: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  parkedSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  parkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  parkedRowText: {
    flex: 1,
  },
  parkedRowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  parkedRowMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderPrepBanner: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.brandOrange,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  orderPrepBannerText: {
    color: colors.brandOrange,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginHorizontal: 20,
  },
});
