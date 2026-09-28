import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useClaimOpenPoolTask, useCompleteOpenPoolTask, useMyOpenPoolTasks, useOpenPoolTasks } from '../hooks/useOpenPool';
import { type OpenPoolTask } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  normal: '#64748b',
  high: '#d97706',
  urgent: '#dc2626',
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
            <View key={task.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{task.title}</Text>
                <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLORS[task.priority] }]}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
              </View>
              {task.description && <Text style={styles.cardDescription}>{task.description}</Text>}
              {complete.error && <Text style={styles.error}>{complete.error.message}</Text>}
              <Pressable
                style={[styles.actionButton, complete.isPending && styles.actionButtonDisabled]}
                disabled={complete.isPending}
                onPress={() => complete.mutate(task.id)}
              >
                {complete.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Mark complete</Text>
                )}
              </Pressable>
            </View>
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

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 4,
  },
  spinner: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 10,
  },
  empty: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    flexShrink: 1,
  },
  cardDescription: {
    fontSize: 13,
    color: '#4b5563',
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
    backgroundColor: '#fd8c1e',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#16a34a',
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
    color: '#dc2626',
    fontSize: 13,
    marginTop: 8,
  },
});
