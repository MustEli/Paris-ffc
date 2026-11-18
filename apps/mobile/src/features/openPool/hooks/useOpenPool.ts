import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { ApiError } from '../../../core/api/client';
import { useAuthStore } from '../../../core/auth/authStore';
import { useSocketEvent } from '../../../core/realtime/useSocketEvent';
import { claimOpenPoolTask, completeOpenPoolTask, fetchMyOpenPoolTasks, fetchOpenPoolTasks } from '../api';
import { type OpenPoolTask } from '../types';

const OPEN_KEY = ['open-pool-tasks', 'open'];
const MINE_KEY = ['open-pool-tasks', 'mine'];
const OPEN_FLOOR_TASK_KEY = ['floor-tasks', 'mine', 'open'];

/**
 * Live-refreshes both lists the instant anyone creates/claims a task —
 * see the backend's openpool:created/claimed events. Also fires a local
 * notification on creation (parity with Directives) — note this can't
 * be remotely retracted from another staff member's device once shown,
 * so a stale tap just lands on an already-updated, "claimed" list.
 */
export function useOpenPoolLiveSync() {
  const queryClient = useQueryClient();
  useSocketEvent<OpenPoolTask>('openpool:created', (task) => {
    queryClient.invalidateQueries({ queryKey: OPEN_KEY });
    Notifications.scheduleNotificationAsync({
      content: { title: 'Open Pool Task', body: task.title, sound: 'default' },
      trigger: null,
    });
  });
  useSocketEvent('openpool:claimed', () => queryClient.invalidateQueries({ queryKey: OPEN_KEY }));
}

export function useOpenPoolTasks() {
  const token = useAuthStore((state) => state.token);
  useOpenPoolLiveSync();
  return useQuery({
    queryKey: OPEN_KEY,
    queryFn: () => fetchOpenPoolTasks(token!),
    enabled: !!token,
  });
}

export function useMyOpenPoolTasks() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: () => fetchMyOpenPoolTasks(token!),
    enabled: !!token,
  });
}

export function useClaimOpenPoolTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => claimOpenPoolTask(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OPEN_KEY });
      queryClient.invalidateQueries({ queryKey: MINE_KEY });
      // The backend auto-pauses an active floor task on claim — refresh it so the Floor Task screen (if open underneath) reflects that immediately.
      queryClient.invalidateQueries({ queryKey: OPEN_FLOOR_TASK_KEY });
    },
    onError: (error, id) => {
      // Lost the race to someone else who claimed it first — that task is
      // just as gone as if it had never been there, so drop it from the
      // open list right away instead of leaving a dangling "already
      // claimed" error on screen for a task the user can no longer act on.
      if (error instanceof ApiError && error.code === 'open_pool.already_claimed') {
        queryClient.setQueryData<OpenPoolTask[]>(OPEN_KEY, (old) => old?.filter((task) => task.id !== id));
      }
    },
  });
}

export function useCompleteOpenPoolTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completionPhotoUrl, completionComment }: { id: string; completionPhotoUrl: string; completionComment: string }) =>
      completeOpenPoolTask(token!, id, completionPhotoUrl, completionComment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE_KEY }),
  });
}
