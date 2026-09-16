import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuthStore } from '../../../core/auth/authStore';
import { endShift, fetchShiftStatus, sendHeartbeat } from '../api';
import { SHIFT_STATUS_QUERY_KEY } from './useShiftStatus';

/** Matches the backend's HEARTBEAT_STALE_TOLERANCE_MS margin — see shifts.service.ts. */
const HEARTBEAT_INTERVAL_MS = 15 * 60_000;

/**
 * Mounted once for the whole Staff session (in StaffNavigator, same
 * pattern as useTaskAssignmentAlerts) — not tied to whichever screen is
 * currently open, since "forgot to end my shift" can happen from any of
 * them. Covers the two auto-end mechanisms agreed on:
 *
 *  1. Best-effort end-shift the moment the app is backgrounded — catches
 *     the common case (switched apps, pressed home) reliably, since the
 *     app is still running long enough to fire one more request.
 *  2. A heartbeat sent every 15 minutes while a shift is active and the
 *     app is open/foregrounded. If the app gets fully closed/killed
 *     instead of just backgrounded, neither this nor #1 can run at all
 *     (a dead process runs no code) — the backend's own staleness check
 *     (shifts.service.ts) is what eventually closes that shift out, the
 *     next time anything asks for its status. This hook's heartbeat is
 *     what keeps that check from firing on a shift that's still
 *     genuinely in use.
 */
export function useShiftLifecycle() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: SHIFT_STATUS_QUERY_KEY,
    queryFn: () => fetchShiftStatus(token!),
    enabled: !!token && role === 'staff',
  });

  const shiftActive = !!status?.active;

  useEffect(() => {
    if (!token || !shiftActive) return;
    const interval = setInterval(() => {
      sendHeartbeat(token).catch(() => {
        // Best-effort — a single missed heartbeat isn't worth surfacing
        // to the user; the tolerance window exists precisely to absorb
        // the occasional dropped one.
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, shiftActive]);

  useEffect(() => {
    if (!token) return;

    function handleAppStateChange(nextState: AppStateStatus) {
      if (!shiftActive) return;
      if (nextState === 'background' || nextState === 'inactive') {
        endShift(token!)
          .then(() => queryClient.invalidateQueries({ queryKey: SHIFT_STATUS_QUERY_KEY }))
          .catch(() => {
            // Best-effort — if this fails (or the app is killed before
            // it completes), the heartbeat/staleness safety net above
            // is what eventually closes the shift out instead.
          });
      }
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [token, shiftActive, queryClient]);
}
