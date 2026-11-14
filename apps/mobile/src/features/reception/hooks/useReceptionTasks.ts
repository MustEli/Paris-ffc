import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  fetchMyActiveReceptionTask,
  leaveUnfinishedReceptionTask,
  pauseReceptionTask,
  resumeReceptionTask,
  startReceptionTask,
} from '../api';

/** Shared across every screen in the Reception-flow timer so Start/Pause/Resume/Leave-Unfinished all see the same "what's active right now" state. */
export const ACTIVE_RECEPTION_TASK_KEY = ['reception-tasks', 'mine', 'active'];

export function useMyActiveReceptionTask() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ACTIVE_RECEPTION_TASK_KEY,
    queryFn: () => fetchMyActiveReceptionTask(token!),
    enabled: !!token,
  });
}

export function useStartReceptionTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startReceptionTask(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_RECEPTION_TASK_KEY }),
  });
}

export function usePauseReceptionTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseReceptionTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_RECEPTION_TASK_KEY }),
  });
}

export function useResumeReceptionTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeReceptionTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_RECEPTION_TASK_KEY }),
  });
}

export function useLeaveUnfinishedReceptionTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => leaveUnfinishedReceptionTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACTIVE_RECEPTION_TASK_KEY }),
  });
}
