import { useQuery } from '@tanstack/react-query';

import { listUsers } from '../../../core/api/users';
import { useAuthStore } from '../../../core/auth/authStore';

export function useStaffUsers() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => listUsers(token!, 'staff'),
    enabled: !!token,
  });
}
