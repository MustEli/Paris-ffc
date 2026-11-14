import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  addInstructions,
  completeReception,
  createReception,
  getReception,
  listReceptions,
  type CreateReceptionInput,
} from '../api';
import { ACTIVE_RECEPTION_TASK_KEY } from './useReceptionTasks';

const RECEPTIONS_KEY = ['receptions'];
const receptionKey = (id: string) => ['receptions', id];

/** List of all receptions — the "real-time log" from the Admin user story. */
export function useReceptions() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: RECEPTIONS_KEY,
    queryFn: () => listReceptions(token!),
    enabled: !!token,
  });
}

export function useReception(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: receptionKey(id),
    queryFn: () => getReception(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreateReception() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReceptionInput) => createReception(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEPTIONS_KEY });
      // A receptionTaskId (if any was sent) just got marked completed server-side.
      queryClient.invalidateQueries({ queryKey: ACTIVE_RECEPTION_TASK_KEY });
    },
  });
}

/**
 * Receptions directly assigned to me via the Task Board (see
 * ReceptionsService.assign()) that I still need to act on — surfaced on
 * the Putaway screen alongside pallet put-away tasks. No dedicated
 * "mine, assigned" endpoint exists, so this filters the same full list
 * ReceptionListScreen already fetches (shared query cache — no extra
 * network cost).
 */
export function useMyAssignedReceptions() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = useReceptions();
  const data = query.data?.filter((r) => r.assignedToUserId === userId && r.status !== 'completed');
  return { ...query, data };
}

export function useAddInstructions(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instructions: string) => addInstructions(token!, id, instructions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: receptionKey(id) });
    },
  });
}

export function useCompleteReception(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => completeReception(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECEPTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: receptionKey(id) });
    },
  });
}
