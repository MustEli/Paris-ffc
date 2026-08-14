import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { createPallet, getPallet, giveInstructions, listPallets, putAway, type CreatePalletInput } from '../api';

const PALLETS_KEY = ['seller-stock'];
const palletKey = (id: string) => ['seller-stock', id];

export function usePallets() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: PALLETS_KEY,
    queryFn: () => listPallets(token!),
    enabled: !!token,
  });
}

export function usePallet(id: string) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: palletKey(id),
    queryFn: () => getPallet(token!, id),
    enabled: !!token && !!id,
  });
}

export function useCreatePallet() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePalletInput) => createPallet(token!, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PALLETS_KEY }),
  });
}

export function useGiveInstructions(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (location: string) => giveInstructions(token!, id, location),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PALLETS_KEY });
      queryClient.invalidateQueries({ queryKey: palletKey(id) });
    },
  });
}

export function usePutAway(id: string) {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => putAway(token!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PALLETS_KEY });
      queryClient.invalidateQueries({ queryKey: palletKey(id) });
    },
  });
}
