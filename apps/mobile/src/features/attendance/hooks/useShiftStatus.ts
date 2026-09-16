import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { endBreak, endShift, fetchShiftStatus, startBreak, startShift, type BreakType } from '../api';

/** Exported so useShiftLifecycle (heartbeat + background auto-end) shares the same cache entry. */
export const SHIFT_STATUS_QUERY_KEY = ['shift-status'];

/**
 * Bundles the status query with the start/end mutations (shift and
 * lunch break both) so ShiftScreen doesn't have to wire up cache
 * invalidation itself — every mutation here just refetches status on
 * success/settle.
 */
export function useShiftStatus() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: SHIFT_STATUS_QUERY_KEY,
    queryFn: () => fetchShiftStatus(token!),
    enabled: !!token,
    // Poll while an actual short break is running, so the on-screen
    // countdown stays accurate and the "allowance ran out" auto-end
    // (see ShiftScreen) fires promptly — not needed the rest of the
    // time, so this doesn't otherwise add any background network use.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.onBreak && data.breakType === 'short' ? 5_000 : false;
    },
  });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: SHIFT_STATUS_QUERY_KEY });
  }

  const startMutation = useMutation({
    mutationFn: () => startShift(token!),
    onSettled: invalidate,
  });

  const endMutation = useMutation({
    mutationFn: () => endShift(token!),
    onSettled: invalidate,
  });

  const startBreakMutation = useMutation({
    mutationFn: (type: BreakType) => startBreak(token!, type),
    onSettled: invalidate,
  });

  const endBreakMutation = useMutation({
    mutationFn: () => endBreak(token!),
    onSettled: invalidate,
  });

  return {
    status: statusQuery.data,
    isLoadingStatus: statusQuery.isPending,
    statusError: statusQuery.error,
    start: startMutation.mutate,
    isStarting: startMutation.isPending,
    startError: startMutation.error,
    end: endMutation.mutate,
    isEnding: endMutation.isPending,
    endError: endMutation.error,
    startBreak: startBreakMutation.mutate,
    isStartingBreak: startBreakMutation.isPending,
    startBreakError: startBreakMutation.error,
    // Ends whichever break type is currently open — the backend doesn't
    // need to be told which, since only one can ever be open at a time.
    endBreak: endBreakMutation.mutate,
    isEndingBreak: endBreakMutation.isPending,
    endBreakError: endBreakMutation.error,
  };
}
