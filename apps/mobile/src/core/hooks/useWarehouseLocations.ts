import { useQuery } from '@tanstack/react-query';

import { fetchWarehouseLocations } from '../api/warehouseLocations';
import { useAuthStore } from '../auth/authStore';

/** Backs every "Put-away location" dropdown (Seller Stock's self put-away, and every instant put-away form). */
export function useWarehouseLocations() {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: ['warehouse-locations'],
    queryFn: () => fetchWarehouseLocations(token!),
    enabled: !!token,
  });
}
