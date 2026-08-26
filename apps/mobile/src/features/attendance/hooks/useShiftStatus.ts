import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { endBreak, endShift, fetchShiftStatus, startBreak, startShift } from '../api';

const SHIFT_STATUS_QUERY_KEY = ['shift-status'];

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
    mutationFn: () => startBreak(token!),
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
    startLunchBreak: startBreakMutation.mutate,
    isStartingBreak: startBreakMutation.isPending,
    startBreakError: startBreakMutation.error,
    endLunchBreak: endBreakMutation.mutate,
    isEndingBreak: endBreakMutation.isPending,
    endBreakError: endBreakMutation.error,
  };
}
