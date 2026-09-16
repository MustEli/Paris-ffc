import { useQuery } from '@tanstack/react-query';

import { fetchReferenceList, type ReferenceListCategory } from '../api/referenceLists';
import { useAuthStore } from '../auth/authStore';

/** Backs any admin-managed dropdown (Reception's Transporter Company / Packaging Type, and future ones). */
export function useReferenceList(category: ReferenceListCategory) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['reference-list', category],
    queryFn: () => fetchReferenceList(token!, category),
    enabled: !!token,
  });
}
