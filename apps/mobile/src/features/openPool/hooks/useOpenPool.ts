import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { useSocketEvent } from '../../../core/realtime/useSocketEvent';
import { claimOpenPoolTask, completeOpenPoolTask, fetchMyOpenPoolTasks, fetchOpenPoolTasks } from '../api';

const OPEN_KEY = ['open-pool-tasks', 'open'];
const MINE_KEY = ['open-pool-tasks', 'mine'];

/** Live-refreshes both lists the instant anyone creates/claims a task — see the backend's openpool:created/claimed events. */
export function useOpenPoolLiveSync() {
  const queryClient = useQueryClient();
  useSocketEvent('openpool:created', () => queryClient.invalidateQueries({ queryKey: OPEN_KEY }));
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
    },
  });
}

export function useCompleteOpenPoolTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => completeOpenPoolTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE_KEY }),
  });
}
