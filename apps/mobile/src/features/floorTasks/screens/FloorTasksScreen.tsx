import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ListRow } from '../../../core/components/ListRow';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useOrderPrepTasks } from '../../orderPrep/hooks/useOrderPrep';
import { useMyOpenFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTasks'>;
}

const OPEN_ORDER_PREP_STATUSES = ['assigned', 'in_progress'];

/**
 * Staff-view redesign's Floor Tasks menu: a vertical list clustered
 * [Pick, Pack] / [Return Processing] / [Putaway] / [Inventory Check,
 * Location Adjustment] / [Backup x3]. Tapping a category opens its one
 * combined page (see FloorTaskDetailScreen) — Start/Pause/Stop all live
 * there, nothing is created just by opening it. If something's already
 * open (started elsewhere, maybe paused), this screen redirects
 * straight to it rather than showing a menu that would just dead-end on
 * every other row (backend only allows one open task at a time).
 * Admin-assigned Order-Prep picker/packer work is a separate system
 * (deliberately not merged with self-serve Pick/Pack here — see this
 * project's history); the banner below just keeps it reachable now
 * that "My Tasks" is gone as its own menu entry.
 */
export function FloorTasksScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data: openTask, isPending, error } = useMyOpenFloorTask();
  const orderPrep = useOrderPrepTasks();
  const openOrderPrepTask = (orderPrep.data ?? []).find((t) => OPEN_ORDER_PREP_STATUSES.includes(t.status));

  useEffect(() => {
    if (openTask) {
      navigation.replace('FloorTaskDetail', { category: openTask.category });
    }
  }, [openTask, navigation]);

  if (isPending || openTask) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>Floor Tasks</Text>
      {error && <Text style={styles.error}>{error.message}</Text>}

      {openOrderPrepTask && (
        <Pressable
          style={styles.orderPrepBanner}
          onPress={() => navigation.navigate('OrderPrepTaskDetail', { id: openOrderPrepTask.id })}
        >
          <Text style={styles.orderPrepBannerText}>
            You have an assigned {openOrderPrepTask.role === 'picker' ? 'Picker' : 'Packer'} task — tap to open it
          </Text>
        </Pressable>
      )}

      {CATEGORY_META.slice(0, 3).map((meta) => (
        <ListRow
          key={meta.category}
          label={meta.label}
          strongDividerBelow={meta.strongDividerBelow}
          onPress={() => navigation.navigate('FloorTaskDetail', { category: meta.category })}
        />
      ))}

      <ListRow label="Putaway" strongDividerBelow onPress={() => navigation.navigate('PutawayUnified')} />

      {CATEGORY_META.slice(3).map((meta) => (
        <ListRow
          key={meta.category}
          label={meta.label}
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
