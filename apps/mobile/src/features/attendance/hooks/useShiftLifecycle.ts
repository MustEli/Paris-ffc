import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useAuthStore } from '../../../core/auth/authStore';
import { fetchShiftStatus, sendHeartbeat } from '../api';
import { SHIFT_STATUS_QUERY_KEY } from './useShiftStatus';

/** Matches the backend's HEARTBEAT_STALE_TOLERANCE_MS margin — see shifts.service.ts. */
const HEARTBEAT_INTERVAL_MS = 15 * 60_000;

/**
 * Mounted once for the whole Staff session (in StaffNavigator, same
 * pattern as useTaskAssignmentAlerts) — not tied to whichever screen is
 * currently open. Just sends a heartbeat every 15 minutes while a shift
 * is active and the app is open/foregrounded, so the backend's own
 * staleness check (shifts.service.ts's HEARTBEAT_STALE_TOLERANCE_MS)
 * doesn't treat a shift that's still genuinely in use as abandoned.
 *
 * An earlier version of this also ended the shift immediately the
 * instant the app's AppState went to 'background'/'inactive' at all —
 * removed entirely after it turned out to misfire on ordinary in-app
 * back-button navigation (Android can report a transient 'inactive'
 * state during a stack-pop transition, not just on a real
 * background/close), silently ending a real, still-in-progress shift
 * with no warning. The backend's staleness tolerance (now 3 hours,
 * deliberately generous) is the only auto-end mechanism left — it only
 * ever fires for a genuinely closed/killed app, never a quick
 * navigation or app-switch.
 */
export function useShiftLifecycle() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.user?.role);

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
}
