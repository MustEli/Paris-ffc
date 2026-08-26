import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
  fetchAdminDashboardReport,
  fetchAttendanceReport,
  fetchOrderPrepReport,
  fetchOverviewReport,
  fetchPutAwayReport,
  fetchReceptionReport,
} from '../api';

/** One hook per report, matching the backend's one-endpoint-per-report split — each renders as its own dashboard section, independently loading/refreshable. */
export function useOverviewReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => fetchOverviewReport(token!),
    enabled: !!token,
  });
}

export function useAttendanceReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'attendance'],
    queryFn: () => fetchAttendanceReport(token!),
    enabled: !!token,
  });
}

export function useReceptionReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'reception'],
    queryFn: () => fetchReceptionReport(token!),
    enabled: !!token,
  });
}

export function usePutAwayReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'put-away'],
    queryFn: () => fetchPutAwayReport(token!),
    enabled: !!token,
  });
}

export function useOrderPrepReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'order-prep'],
    queryFn: () => fetchOrderPrepReport(token!),
    enabled: !!token,
  });
}

/**
 * Admin's home screen — "what's happening right now" is the whole
 * point, so this one auto-refreshes every 30s in the background on top
 * of the usual pull-to-refresh, unlike Management's Dashboard (which
 * only refreshes on demand).
 */
export function useAdminDashboardReport() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reports', 'admin-dashboard'],
    queryFn: () => fetchAdminDashboardReport(token!),
    enabled: !!token,
    refetchInterval: 30_000,
  });
}
