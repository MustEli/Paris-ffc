import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { ListRow } from '../../../core/components/ListRow';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { useOrderPrepTasks } from '../../orderPrep/hooks/useOrderPrep';
import { MultiPhotoCapture } from '../../sellerStock/components/MultiPhotoCapture';
import { useEndFloorTask, useMyOpenFloorTask, usePauseFloorTask, useResumeFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META, FLOOR_TASK_MAX_PHOTOS, type CategoryMeta, type FloorTaskLog } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTasks'>;
}

function metaFor(category: string): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}

const OPEN_ORDER_PREP_STATUSES = ['assigned', 'in_progress'];

/**
 * Staff-view redesign's Floor Tasks menu: a vertical list clustered
 * [Pick, Pack] / [Return Processing] / [Putaway] / [Inventory Check,
 * Location Adjustment] / [Backup x3]. Tapping a category only opens a
 * preview with its own Start button (see FloorTaskDetailScreen) — a
 * FloorTaskLog isn't created until Start is actually pressed, so a
 * mis-tap just goes back via the normal Back button, nothing to undo.
 * Same one-open-task-at-a-time backend rule as before — this screen
 * only ever shows the picker OR the one active task. Admin-assigned
 * Order-Prep picker/packer work is a separate system (deliberately not
 * merged with self-serve Pick/Pack here — see this project's history);
 * the banner below just keeps it reachable now that "My Tasks" is gone
 * as its own menu entry.
 */
export function FloorTasksScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { data: openTask, isPending, error } = useMyOpenFloorTask();
  const orderPrep = useOrderPrepTasks();
  const openOrderPrepTask = (orderPrep.data ?? []).find((t) => OPEN_ORDER_PREP_STATUSES.includes(t.status));

  if (isPending) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  if (openTask) {
    return <ActiveFloorTaskCard task={openTask} />;
  }

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

function ActiveFloorTaskCard({ task }: { task: FloorTaskLog }) {
  const insets = useSafeAreaInsets();
  const meta = metaFor(task.category);
  const [count, setCount] = useState('');
  const [countExtra, setCountExtra] = useState('');
  const [zone, setZone] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const end = useEndFloorTask(task.id);
  const pause = usePauseFloorTask(task.id);
  const resume = useResumeFloorTask(task.id);
  const isPaused = !!task.pausedAt;

  const needsComment = meta.category === 'backup_other' || meta.needsComment;
  const commentRequired = meta.category === 'backup_other';

  const isValid =
    (!meta.countLabel || count.trim() !== '') &&
    (!meta.needsZone || zone.trim() !== '') &&
    (!commentRequired || comment.trim() !== '');

  function handleEnd() {
    end.mutate({
      count: meta.countLabel ? Number(count) : undefined,
      countExtra: meta.countExtraLabel ? Number(countExtra) : undefined,
      zone: meta.needsZone ? zone.trim() : undefined,
      comment: needsComment && comment.trim() ? comment.trim() : undefined,
      photoUrls: meta.needsPhotos ? photos : undefined,
    });
  }

  return (
    <KeyboardAwareScreen contentContainerStyle={[styles.formContainer, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.titleRow}>
        <Text style={styles.activeCardTitle}>{meta.label}</Text>
        <Pressable
          onPress={() => (isPaused ? resume.mutate() : pause.mutate())}
          disabled={pause.isPending || resume.isPending}
          hitSlop={8}
        >
          <Text style={styles.pauseLink}>
            {pause.isPending || resume.isPending ? 'Working…' : isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>
      </View>
      {isPaused && <Text style={styles.pausedBanner}>Paused</Text>}
      <Text style={styles.startedAt}>Started {new Date(task.startedAt).toLocaleTimeString()}</Text>
      {pause.error && <Text style={styles.error}>{pause.error.message}</Text>}
      {resume.error && <Text style={styles.error}>{resume.error.message}</Text>}

      {meta.countLabel && (
        <>
          <Text style={styles.label}>{meta.countLabel}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={count}
            onChangeText={setCount}
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      {meta.countExtraLabel && (
        <>
          <Text style={styles.label}>{meta.countExtraLabel}</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={countExtra}
            onChangeText={setCountExtra}
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      {meta.needsZone && (
        <>
          <Text style={styles.label}>Zone / Location</Text>
          <TextInput
            style={styles.input}
            value={zone}
            onChangeText={setZone}
            placeholder="e.g. Zone A, Racks 1-10"
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      {needsComment && (
        <>
          <Text style={styles.label}>Comment{commentRequired ? '' : ' (optional)'}</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            multiline
            value={comment}
            onChangeText={setComment}
            placeholderTextColor={colors.textMuted}
          />
        </>
      )}

      {meta.needsPhotos && (
        <View style={styles.photoSection}>
          <MultiPhotoCapture label="Photos" photos={photos} onChange={setPhotos} maxPhotos={FLOOR_TASK_MAX_PHOTOS} />
        </View>
      )}

      {end.error && <Text style={styles.error}>{end.error.message}</Text>}

      <Pressable
        style={[styles.endButton, (!isValid || end.isPending) && styles.endButtonDisabled]}
        disabled={!isValid || end.isPending}
        onPress={handleEnd}
      >
        {end.isPending ? <ActivityIndicator color="#1a1200" /> : <Text style={styles.endButtonText}>End {meta.label}</Text>}
      </Pressable>
    </KeyboardAwareScreen>
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
  formContainer: {
    padding: 20,
    gap: 4,
    backgroundColor: colors.background,
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  activeCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pauseLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brandOrange,
  },
  pausedBanner: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandOrange,
    marginBottom: 6,
  },
  startedAt: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  photoSection: {
    marginTop: 16,
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginTop: 16,
  },
  endButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  endButtonDisabled: {
    opacity: 0.4,
  },
  endButtonText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
});
