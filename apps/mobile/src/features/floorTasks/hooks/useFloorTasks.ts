import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  endFloorTask,
  fetchMyOpenFloorTask,
  pauseFloorTask,
  resumeFloorTask,
  startFloorTask,
  type EndFloorTaskInput,
} from '../api';
import { type FloorTaskCategory } from '../types';

const OPEN_TASK_KEY = ['floor-tasks', 'mine', 'open'];

export function useMyOpenFloorTask() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: OPEN_TASK_KEY,
    queryFn: () => fetchMyOpenFloorTask(token!),
    enabled: !!token,
  });
}

export function useStartFloorTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category: FloorTaskCategory) => startFloorTask(token!, category),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPEN_TASK_KEY }),
  });
}

export function useEndFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EndFloorTaskInput) => endFloorTask(token!, id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPEN_TASK_KEY }),
  });
}

export function usePauseFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseFloorTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPEN_TASK_KEY }),
  });
}

export function useResumeFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeFloorTask(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OPEN_TASK_KEY }),
  });
}
