import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { resolvePhotoUrl } from '../../../core/api/upload';
import { colors } from '../../../core/theme/colors';
import { PhotoCaptureButton } from '../../sellerStock/components/PhotoCaptureButton';
import { useClaimOpenPoolTask, useCompleteOpenPoolTask, useMyOpenPoolTasks, useOpenPoolTasks } from '../hooks/useOpenPool';
import { type OpenPoolTask } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  normal: colors.textSecondary,
  high: colors.brandOrange,
  urgent: colors.alert,
};

/**
 * Open Pool Tasks doc: Admin publishes a task with no specific assignee
 * — any active staff member can claim it, first to succeed wins. Both
 * lists update live over the socket (see useOpenPoolLiveSync) so a task
 * someone else just claimed disappears here without waiting for a poll.
 */
export function OpenPoolScreen() {
  const { data: openTasks, isPending: openPending, error: openError } = useOpenPoolTasks();
  const { data: myTasks, isPending: minePending } = useMyOpenPoolTasks();
  const claim = useClaimOpenPoolTask();
  const complete = useCompleteOpenPoolTask();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {myTasks && myTasks.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>My claimed tasks</Text>
          {myTasks.map((task) => (
            <ClaimedTaskCard key={task.id} task={task} complete={complete} />
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Available tasks</Text>
      {openPending || minePending ? <ActivityIndicator style={styles.spinner} /> : null}
      {openError && <Text style={styles.error}>{openError.message}</Text>}
      {claim.error && <Text style={styles.error}>{claim.error.message}</Text>}
      {!openPending && (!openTasks || openTasks.length === 0) && (
        <Text style={styles.empty}>Nothing in the open pool right now.</Text>
      )}
      {openTasks?.map((task: OpenPoolTask) => (
        <View key={task.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{task.title}</Text>
            <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
              <Text style={styles.priorityText}>{task.priority}</Text>
            </View>
          </View>
          {task.description && <Text style={styles.cardDescription}>{task.description}</Text>}
          <Pressable
            style={[styles.claimButton, claim.isPending && styles.actionButtonDisabled]}
            disabled={claim.isPending}
            onPress={() => claim.mutate(task.id)}
          >
            {claim.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Claim task</Text>}
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/** Shows the admin's creation photo/comment automatically (no separate detail screen/tap needed), and requires a photo + comment to mark the task done. */
function ClaimedTaskCard({ task, complete }: { task: OpenPoolTask; complete: ReturnType<typeof useCompleteOpenPoolTask> }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  function handleComplete() {
    if (!photoUrl || !comment.trim()) return;
    complete.mutate(
      { id: task.id, completionPhotoUrl: photoUrl, completionComment: comment.trim() },
      {
        onSuccess: () => {
          setPhotoUrl(null);
          setComment('');
        },
      },
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{task.title}</Text>
        <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
          <Text style={styles.priorityText}>{task.priority}</Text>
        </View>
      </View>
      {task.description && <Text style={styles.cardDescription}>{task.description}</Text>}

      {(task.creationPhotoUrl || task.creationComment) && (
        <View style={styles.creationBox}>
          {task.creationComment && <Text style={styles.creationComment}>{task.creationComment}</Text>}
          {task.creationPhotoUrl && (
            <Image source={{ uri: resolvePhotoUrl(task.creationPhotoUrl) }} style={styles.creationPhoto} />
          )}
        </View>
      )}

      <View style={styles.photoWrap}>
        <PhotoCaptureButton label="Photo" value={photoUrl} onChange={setPhotoUrl} />
      </View>
      <TextInput
        style={styles.commentInput}
        placeholder="Comment"
        placeholderTextColor={colors.textMuted}
        multiline
        value={comment}
        onChangeText={setComment}
      />
      {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
      <Pressable
        style={[styles.actionButton, (!photoUrl || !comment.trim() || complete.isPending) && styles.actionButtonDisabled]}
        disabled={!photoUrl || !comment.trim() || complete.isPending}
        onPress={handleComplete}
      >
        {complete.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Mark complete</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 4,
    backgroundColor: colors.background,
  },
  spinner: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 10,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  cardDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  priorityText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  claimButton: {
    backgroundColor: colors.brandOrange,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  creationBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  creationComment: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  creationPhoto: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  photoWrap: {
    marginTop: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceElevated,
    minHeight: 60,
    textAlignVertical: 'top',
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: colors.success,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginTop: 8,
  },
});
