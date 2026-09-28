import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardAwareScreen } from '../../../core/components/KeyboardAwareScreen';
import { MultiPhotoCapture } from '../../sellerStock/components/MultiPhotoCapture';
import { useEndFloorTask, useMyOpenFloorTask, useStartFloorTask } from '../hooks/useFloorTasks';
import { CATEGORY_META, FLOOR_TASK_MAX_PHOTOS, type CategoryMeta, type FloorTaskLog } from '../types';

function metaFor(category: string): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}

/**
 * Staff View doc's self-serve floor tasks — deliberately simple: no
 * admin assignment, staff starts a category whenever, declares counts
 * on end ("for now we trust the employees / self declaration"). Only
 * one can be open at a time (backend-enforced), which is also why the
 * screen only ever shows either the category picker OR the one active
 * task expanded — matches the customer's own stated preference ("I
 * prefer the staff see only the task that is being done by him").
 */
export function FloorTasksScreen() {
  const { data: openTask, isPending, error } = useMyOpenFloorTask();
  const start = useStartFloorTask();

  if (isPending) return <ActivityIndicator style={styles.spinner} />;

  if (openTask) {
    return <ActiveFloorTaskCard task={openTask} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Floor Tasks</Text>
      {error && <Text style={styles.error}>{error.message}</Text>}
      {start.error && <Text style={styles.error}>{start.error.message}</Text>}
      {CATEGORY_META.map((meta) => (
        <Pressable
          key={meta.category}
          style={[styles.tile, start.isPending && styles.tileDisabled]}
          onPress={() => start.mutate(meta.category)}
          disabled={start.isPending}
        >
          <Text style={styles.tileLabel}>{meta.label}</Text>
          <Text style={styles.tileAction}>Start</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ActiveFloorTaskCard({ task }: { task: FloorTaskLog }) {
  const meta = metaFor(task.category);
  const [count, setCount] = useState('');
  const [countExtra, setCountExtra] = useState('');
  const [zone, setZone] = useState('');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const end = useEndFloorTask(task.id);

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
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.title}>{meta.label}</Text>
      <Text style={styles.startedAt}>Started {new Date(task.startedAt).toLocaleTimeString()}</Text>

      {meta.countLabel && (
        <>
          <Text style={styles.label}>{meta.countLabel}</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={count} onChangeText={setCount} />
        </>
      )}

      {meta.countExtraLabel && (
        <>
          <Text style={styles.label}>{meta.countExtraLabel}</Text>
          <TextInput style={styles.input} keyboardType="number-pad" value={countExtra} onChangeText={setCountExtra} />
        </>
      )}

      {meta.needsZone && (
        <>
          <Text style={styles.label}>Zone / Location</Text>
          <TextInput style={styles.input} value={zone} onChangeText={setZone} placeholder="e.g. Zone A, Racks 1-10" />
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
        style={[styles.endButton, (!isValid || end.isPending) && styles.tileDisabled]}
        disabled={!isValid || end.isPending}
        onPress={handleEnd}
      >
        {end.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.endButtonText}>End {meta.label}</Text>}
      </Pressable>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 4,
  },
  spinner: {
    marginTop: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  startedAt: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },
  tile: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileDisabled: {
    opacity: 0.5,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  tileAction: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fd8c1e',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  photoSection: {
    marginTop: 16,
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    marginTop: 16,
  },
  endButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 28,
  },
  endButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
