import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  cancelFloorTask,
  endFloorTask,
  fetchMyOpenFloorTask,
  fetchMyOpenFloorTasks,
  pauseFloorTask,
  pauseMyFloorTask,
  resumeFloorTask,
  startFloorTask,
  type EndFloorTaskInput,
} from '../api';
import { type FloorTaskCategory } from '../types';

const OPEN_TASK_KEY = ['floor-tasks', 'mine', 'open'];
const OPEN_TASKS_KEY = ['floor-tasks', 'mine', 'open-all'];

/** The one actively-*running* task, if any — a merely-paused one doesn't count. Use useMyOpenFloorTasks for the full open set. */
export function useMyOpenFloorTask() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: OPEN_TASK_KEY,
    queryFn: () => fetchMyOpenFloorTask(token!),
    enabled: !!token,
  });
}

/** Every currently-open task (running or paused) — powers the "resume this one" match-by-category logic and the parked-tasks list. */
export function useMyOpenFloorTasks() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: OPEN_TASKS_KEY,
    queryFn: () => fetchMyOpenFloorTasks(token!),
    enabled: !!token,
  });
}

/** Every mutation below touches both the single-active-task view and the full open-set view, so both stay in sync. */
function invalidateOpenTaskQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: OPEN_TASK_KEY });
  queryClient.invalidateQueries({ queryKey: OPEN_TASKS_KEY });
}

export function useStartFloorTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category: FloorTaskCategory) => startFloorTask(token!, category),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}

export function useEndFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EndFloorTaskInput) => endFloorTask(token!, id, input),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}

export function usePauseFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseFloorTask(token!, id),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}

export function useResumeFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => resumeFloorTask(token!, id),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}

/** "Never mind, I didn't mean to start this" — see cancelFloorTask's doc comment. */
export function useCancelFloorTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelFloorTask(token!, id),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}

/** See pauseMyFloorTask's doc comment — no task id needed, used by the global Home-icon leaving-guard. */
export function usePauseMyFloorTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pauseMyFloorTask(token!),
    onSuccess: () => invalidateOpenTaskQueries(queryClient),
  });
}
