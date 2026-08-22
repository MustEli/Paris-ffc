import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  assignTask,
  completeTask,
  getTask,
  listTasks,
  reassignTask,
  reportIssue,
  startTask,
  type AssignTaskInput,
} from '../api';

const TASKS_KEY = ['put-away-tasks'];
const taskKey = (id: string) => ['put-away-tasks', id];
// Pallet status changes as a side effect of most task actions (assign →
// instructed, complete → put_away) — invalidate broadly so the Seller
// Stock screens the user came from stay in sync too.
const PALLETS_KEY = ['seller-stock'];

export function useTasks() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => listTasks(token!),
    enabled: !!token,
  });
}

export function useTask(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: taskKey(id),
    queryFn: () => getTask(token!, id),
    enabled: !!token && !!id,
  });
}

export function useAssignTask() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AssignTaskInput) => assignTask(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: PALLETS_KEY });
    },
  });
}

function useTaskAction(mutationFn: (token: string) => Promise<unknown>) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: PALLETS_KEY });
    },
  });
}

export function useStartTask(id: string) {
  return useTaskAction((token) => startTask(token, id));
}

export function useCompleteTask(id: string) {
  return useTaskAction((token) => completeTask(token, id));
}

export function useReportIssue(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (description: string) => reportIssue(token!, id, description),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useReassignTask(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignedToUserId, location }: { assignedToUserId: string; location?: string }) =>
      reassignTask(token!, id, assignedToUserId, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: PALLETS_KEY });
    },
  });
}
