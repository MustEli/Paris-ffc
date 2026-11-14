import { useQuery } from '@tanstack/react-query';

import { fetchStaffUsers } from '../api/users';
import { useAuth } from '../auth/AuthContext';

/** Resolves a user id to a name, including staff who have since gone off-shift. Shared across every admin page that needs to show "who did this." */
export function useStaffNames() {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ['staff-users'],
    queryFn: () => fetchStaffUsers(token!),
    enabled: !!token,
  });
  const nameById = new Map((data ?? []).map((s) => [s.id, s.name]));
  return (userId: string | null) => (userId ? (nameById.get(userId) ?? userId) : '—');
}
