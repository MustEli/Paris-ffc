import { apiRequest } from './client';

/** Mirrors packages/backend/src/warehouse-locations/warehouse-location.types.ts. */
export interface WarehouseLocation {
  id: string;
  location: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Any authenticated role can read — feeds every "Put-away location" dropdown. */
export function fetchWarehouseLocations(token: string) {
  return apiRequest<WarehouseLocation[]>('/warehouse-locations', { token });
}
