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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RECEPTIONS_KEY }),
  });
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
