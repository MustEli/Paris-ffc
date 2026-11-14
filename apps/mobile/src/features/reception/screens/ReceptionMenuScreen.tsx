import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MenuBox } from '../../../core/components/MenuBox';
import { useActiveReceptionTaskStore } from '../../../core/navigation/activeReceptionTaskStore';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import {
  useLeaveUnfinishedReceptionTask,
  useMyActiveReceptionTask,
  usePauseReceptionTask,
} from '../hooks/useReceptionTasks';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'ReceptionMenu'>;
}

/** Reception's 4-way split — tap a category, land in its own world (history + add new), or Seller Stock's own feature for pallets. */
export function ReceptionMenuScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: activeTask } = useMyActiveReceptionTask();
  const pause = usePauseReceptionTask(activeTask?.id ?? '');
  const leaveUnfinished = useLeaveUnfinishedReceptionTask(activeTask?.id ?? '');

  // Only set once Start has actually been pressed (see ReceptionStartScreen)
  // and not yet paused — a paused task has nothing left to "leave".
  const isRunning = !!activeTask && !activeTask.pausedAt;

  useEffect(() => {
    if (!isRunning) return;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert(t('reception.leavingTitle'), t('reception.leavingMessage'), [
        { text: t('reception.keepWorking'), style: 'cancel' },
        {
          text: t('reception.pause'),
          onPress: () => pause.mutate(undefined, { onSuccess: () => navigation.dispatch(e.data.action) }),
        },
        {
          text: t('reception.leaveUnfinished'),
          style: 'destructive',
          onPress: () => leaveUnfinished.mutate(undefined, { onSuccess: () => navigation.dispatch(e.data.action) }),
        },
      ]);
    });
  }, [isRunning, navigation, pause, leaveUnfinished, t]);

  // The Home icon jumps straight to StaffHome from a different part of
  // the stack, which doesn't fire this screen's beforeRemove listener —
  // mirror the running task's id into a global store so ShiftStatusBar
  // can offer the same 3-way choice from there too.
  const setActiveReceptionTaskId = useActiveReceptionTaskStore((state) => state.setActiveReceptionTaskId);
  useEffect(() => {
    setActiveReceptionTaskId(isRunning ? (activeTask?.id ?? null) : null);
    return () => setActiveReceptionTaskId(null);
  }, [isRunning, activeTask?.id, setActiveReceptionTaskId]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      <Text style={styles.title}>{t('reception.title')}</Text>

      <MenuBox
        label={t('reception.returnParcels')}
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'return_parcels' })}
      />
      <MenuBox
        label={t('reception.packagingStock')}
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'packaging_stock' })}
      />
      <MenuBox label={t('reception.sellersStock')} onPress={() => navigation.navigate('SellerStockList')} />
      <MenuBox
        label={t('reception.equipmentOther')}
        onPress={() => navigation.navigate('ReceptionList', { categoryFilter: 'equipment_other' })}
      />
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
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
});
