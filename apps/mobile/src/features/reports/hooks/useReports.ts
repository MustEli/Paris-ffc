import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import {
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
