import { Ionicons } from '@expo/vector-icons';
import { type RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { colors } from '../../../core/theme/colors';
import { type StaffStackParamList } from '../../../navigation/types';
import { MultiPhotoCapture } from '../../sellerStock/components/MultiPhotoCapture';
import {
  useEndFloorTask,
  useMyOpenFloorTask,
  usePauseFloorTask,
  useResumeFloorTask,
  useStartFloorTask,
} from '../hooks/useFloorTasks';
import { CATEGORY_META, FLOOR_TASK_MAX_PHOTOS, type CategoryMeta } from '../types';

interface Props {
  navigation: NativeStackNavigationProp<StaffStackParamList, 'FloorTaskDetail'>;
  route: RouteProp<StaffStackParamList, 'FloorTaskDetail'>;
}

function metaFor(category: string): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}

/** "H:MM:SS", counting up — matches the shift-status bar's elapsed-time format. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * One combined page per category — reachable directly by tapping its
 * row (or the global ActiveFloorTaskIndicator popup), no separate
 * "press Start to even see this" wall. Its fields are visible either
 * way; only the bottom action changes: Start before a FloorTaskLog
 * exists, then live duration + Pause/Stop once it does. If a *different*
 * task is already open (only one can be, backend-enforced), this shows
 * that one's content instead of a dead-end "Start" for the category
 * that was actually tapped — the same rule FloorTasksScreen's redirect
 * relies on.
 */
export function FloorTaskDetailScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { data: openTask, isPending } = useMyOpenFloorTask();
  const activeCategory = openTask?.category ?? route.params.category;
  const meta = metaFor(activeCategory);

  const [count, setCount] = useState('');
  const [countExtra, setCountExtra] = useState('');
  const [zone, setZone] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const start = useStartFloorTask();
  const end = useEndFloorTask(openTask?.id ?? '');
  const pause = usePauseFloorTask(openTask?.id ?? '');
  const resume = useResumeFloorTask(openTask?.id ?? '');
  const isPaused = !!openTask?.pausedAt;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!openTask || isPaused) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [openTask, isPaused]);

  const needsComment = meta.category === 'backup_other' || meta.needsComment;
  const commentRequired = meta.category === 'backup_other';

  const isValid =
    (!meta.countLabel || count.trim() !== '') &&
    (!meta.needsZone || zone.trim() !== '') &&
    (!commentRequired || comment.trim() !== '');

  // Running (open and not paused) blocks leaving this page entirely —
  // only a Pause makes it safe to go elsewhere. Covers Home, Back, the
  // hardware/gesture back, all in one place, since all of them remove
  // this screen from the stack the same way.
  const isRunning = !!openTask && !isPaused;
  useEffect(() => {
    if (!isRunning) return;
    return navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      Alert.alert('Pause first', 'Pause this task before leaving its page.');
    });
  }, [isRunning, navigation]);

  function handleStop() {
    const endInput = {
      count: meta.countLabel ? Number(count) : undefined,
      countExtra: meta.countExtraLabel ? Number(countExtra) : undefined,
      zone: meta.needsZone ? zone.trim() : undefined,
      comment: needsComment && comment.trim() ? comment.trim() : undefined,
      photoUrls: meta.needsPhotos ? photos : undefined,
    };

    if (!isValid) {
      // Nothing (or not enough) was entered — most likely an accidental
      // start. Stop must always be pressable, so this pauses instead of
      // failing: the record stays, restartable, until it's actually
      // finished with the required fields filled in. Already paused?
      // Nothing to do — just repeat why it can't finish yet.
      const message = "This task needs its required fields before it can finish — it's paused for now, resume anytime to finish it.";
      if (isPaused) {
        Alert.alert('Still paused', message);
      } else {
        pause.mutate(undefined, { onSuccess: () => Alert.alert('Paused', message) });
      }
      return;
    }

    Alert.alert(`Stop ${meta.label}?`, "This finishes the task — you won't be able to add more to it afterward.", [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => end.mutate(endInput) },
    ]);
  }

  if (isPending) return <ActivityIndicator style={styles.spinner} color={colors.textSecondary} />;

  const elapsedMs = openTask ? now - new Date(openTask.startedAt).getTime() - openTask.totalPausedMs : 0;

  return (
    <KeyboardAwareScreen contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>{meta.label}</Text>

      {openTask ? (
        <>
          <Text style={isPaused ? styles.pausedBanner : styles.elapsed}>
            {isPaused ? 'Paused' : formatElapsed(elapsedMs)}
          </Text>
          <Text style={styles.startedAt}>Started {new Date(openTask.startedAt).toLocaleTimeString()}</Text>
        </>
      ) : (
        <Text style={styles.subtitle}>Nothing starts until you press Start.</Text>
      )}

      {start.error && <Text style={styles.error}>{start.error.message}</Text>}
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

      {!openTask ? (
        <Pressable
          style={[styles.primaryButton, start.isPending && styles.buttonBusy]}
          disabled={start.isPending}
          onPress={() => start.mutate(route.params.category)}
        >
          {start.isPending ? (
            <ActivityIndicator color="#1a1200" />
          ) : (
            <Text style={styles.primaryButtonText}>Start {meta.label}</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.actionRow}>
          <View style={styles.iconButtonGroup}>
            <Pressable
              style={[styles.iconButton, styles.pauseIconButton, (pause.isPending || resume.isPending) && styles.buttonBusy]}
              disabled={pause.isPending || resume.isPending}
              onPress={() => (isPaused ? resume.mutate() : pause.mutate())}
            >
              {pause.isPending || resume.isPending ? (
                <ActivityIndicator color={colors.brandOrange} />
              ) : (
                <Ionicons name={isPaused ? 'play' : 'pause'} size={28} color={colors.brandOrange} />
              )}
            </Pressable>
            <Text style={styles.iconButtonLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </View>

          <View style={styles.iconButtonGroup}>
            <Pressable
              style={[styles.iconButton, styles.stopIconButton, end.isPending && styles.buttonBusy]}
              disabled={end.isPending}
              onPress={handleStop}
            >
              {end.isPending ? <ActivityIndicator color="#fff" /> : <Ionicons name="stop" size={28} color="#fff" />}
            </Pressable>
            <Text style={styles.iconButtonLabel}>Stop</Text>
          </View>
        </View>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
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
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 8,
  },
  elapsed: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.brandOrange,
    marginTop: 8,
  },
  pausedBanner: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.brandOrange,
    marginTop: 8,
  },
  startedAt: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
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
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.brandOrange,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonBusy: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginTop: 32,
  },
  iconButtonGroup: {
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseIconButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.brandOrange,
  },
  stopIconButton: {
    backgroundColor: colors.alert,
  },
  iconButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
