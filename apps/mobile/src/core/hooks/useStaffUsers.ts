import { useQuery } from '@tanstack/react-query';

import { listUsers } from '../api/users';
import { useAuthStore } from '../auth/authStore';

/** Shared by any feature with a "assign to staff" picker (Put-Away, Order Prep). */
export function useStaffUsers() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['users', 'staff'],
    queryFn: () => listUsers(token!, 'staff'),
    enabled: !!token,
  });
}
