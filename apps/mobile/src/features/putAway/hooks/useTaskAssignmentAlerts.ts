import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { useAuthStore } from '../../../core/auth/authStore';
import { listTasks } from '../api';

const POLL_INTERVAL_MS = 15000;
const TASKS_KEY = ['put-away-tasks'];

/**
 * Runs for the whole staff session — mounted once in StaffNavigator, not
 * tied to any specific screen — so a new assignment gets flagged no
 * matter what the staff member is currently looking at. Shares its
 * query key with usePutAwayTasks' useTasks(), so this doesn't double
 * the network traffic when the task list screen is also open; it just
 * keeps polling after that screen is left.
 */
export function useTaskAssignmentAlerts() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);
  const seenTaskIds = useRef<Set<string> | null>(null);

  const { data: tasks } = useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => listTasks(token!),
    enabled: !!token && role === 'staff',
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (!tasks) return;

    if (seenTaskIds.current === null) {
      // First load this session — these are pre-existing, not "new".
      seenTaskIds.current = new Set(tasks.map((t) => t.id));
      return;
    }

    const newlyAssigned = tasks.filter(
      (t) => t.status === 'assigned' && !seenTaskIds.current!.has(t.id),
    );
    for (const task of newlyAssigned) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'New put-away task',
          body: `Assigned: ${task.location}`,
          sound: 'default',
        },
        trigger: null,
      });
    }

    seenTaskIds.current = new Set(tasks.map((t) => t.id));
  }, [tasks]);
}
