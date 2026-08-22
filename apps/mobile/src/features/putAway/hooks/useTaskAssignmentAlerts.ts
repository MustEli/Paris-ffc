import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../../../core/auth/authStore';
import { listTasks } from '../api';

const POLL_INTERVAL_MS = 15000;
const TASKS_KEY = ['put-away-tasks'];

/**
 * "New" here means "assigned recently" (by timestamp), not "an ID we
 * haven't seen before in this component's lifetime" — the latter breaks
 * the moment this hook remounts (e.g. staff logs out, admin assigns a
 * task, staff logs back in): a freshly-mounted "seen" set would treat
 * that task as pre-existing baseline and never notify about it. Using
 * assignedAt survives logout/login and app restarts without needing any
 * persisted state, at the cost of a small window (this threshold)
 * where an old backlog item wouldn't re-notify on a fresh mount either
 * — which is the right tradeoff: we want "you just got a task", not "you
 * have unstarted tasks", for an alert like this.
 */
const RECENT_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export function useTaskAssignmentAlerts() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);
  // Tracks tasks already notified about, so a task recent enough to
  // qualify doesn't get re-announced on every subsequent poll while it
  // stays within the recency window.
  const notifiedTaskIds = useRef(new Set<string>());

  const { data: tasks } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => listTasks(token!),
    enabled: !!token && role === 'staff',
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (!tasks) return;

    const now = Date.now();
    const newlyAssigned = tasks.filter(
      (t) =>
        t.status === 'assigned' &&
        !notifiedTaskIds.current.has(t.id) &&
        now - new Date(t.assignedAt).getTime() < RECENT_THRESHOLD_MS,
    );

    for (const task of newlyAssigned) {
      notifiedTaskIds.current.add(task.id);
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'New put-away task',
          body: `Assigned: ${task.location}`,
          sound: 'default',
        },
        trigger: null,
      });
    }
  }, [tasks]);
}
