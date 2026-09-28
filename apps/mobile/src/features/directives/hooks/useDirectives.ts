import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '../../../core/auth/authStore';
import { useSocketEvent } from '../../../core/realtime/useSocketEvent';
import { acknowledgeDirective, fetchMyDirectives, resolveDirective } from '../api';
import { DIRECTIVE_TYPE_LABELS, type Directive } from '../types';

const MINE_KEY = ['directives', 'mine'];

/** Live-refreshes the moment Admin pushes one, or anyone (including someone else) acknowledges an "anyone available" one. */
export function useMyDirectives() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);
  const queryClient = useQueryClient();

  useSocketEvent<Directive>('directive:pushed', (directive) => {
    queryClient.invalidateQueries({ queryKey: MINE_KEY });
    Notifications.scheduleNotificationAsync({
      content: { title: DIRECTIVE_TYPE_LABELS[directive.type], body: directive.message, sound: 'default' },
      trigger: null,
    });
  });
  useSocketEvent('directive:acknowledged', () => queryClient.invalidateQueries({ queryKey: MINE_KEY }));

  return useQuery({
    queryKey: MINE_KEY,
    queryFn: () => fetchMyDirectives(token!),
    enabled: !!token && role === 'staff',
    refetchInterval: 15_000,
  });
}

export function useAcknowledgeDirective() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acknowledgeDirective(token!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE_KEY }),
  });
}

export function useResolveDirective() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, photoUrl }: { id: string; photoUrl?: string }) => resolveDirective(token!, id, photoUrl),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINE_KEY }),
  });
}
