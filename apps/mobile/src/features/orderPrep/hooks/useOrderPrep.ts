import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  assignTask,
  completeTask,
  createSession,
  getSession,
  getTask,
  listSessions,
  listTasks,
  startTask,
} from '../api';
import { type OrderPrepTaskRole } from '../types';

const SESSIONS_KEY = ['order-prep-sessions'];
const sessionKey = (id: string) => ['order-prep-sessions', id];
const TASKS_KEY = ['order-prep-tasks'];
const taskKey = (id: string) => ['order-prep-tasks', id];

export function useSessions() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => listSessions(token!),
    enabled: !!token,
  });
}

export function useSession(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: sessionKey(id),
    queryFn: () => getSession(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateSession() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (totalParts: number) => createSession(token!, totalParts),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });
}

export function useAssignOrderPrepTask(sessionId: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignedToUserId, role }: { assignedToUserId: string; role: OrderPrepTaskRole }) =>
      assignTask(token!, sessionId, assignedToUserId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKey(sessionId) });
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
}

export function useOrderPrepTasks() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: TASKS_KEY,
    queryFn: () => listTasks(token!),
    enabled: !!token,
  });
}

export function useOrderPrepTask(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: taskKey(id),
    queryFn: () => getTask(token!, id),
    enabled: !!token && !!id,
  });
}

function useOrderPrepTaskAction(id: string, mutationFn: (token: string) => Promise<unknown>) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      queryClient.invalidateQueries({ queryKey: taskKey(id) });
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useStartOrderPrepTask(id: string) {
  return useOrderPrepTaskAction(id, (token) => startTask(token, id));
}

export function useCompleteOrderPrepTask(id: string) {
  return useOrderPrepTaskAction(id, (token) => completeTask(token, id));
}
