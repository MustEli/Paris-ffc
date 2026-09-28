import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { fetchMySchedule } from '../api';

export function useMySchedule() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => fetchMySchedule(token!),
    enabled: !!token,
  });
}
