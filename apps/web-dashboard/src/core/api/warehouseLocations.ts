import { apiRequest } from './client';

/** Mirrors packages/backend/src/warehouse-locations/warehouse-location.types.ts. */
export interface WarehouseLocation {
  id: string;
  location: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BulkWarehouseLocationItem {
  location: string;
  description?: string;
}

export interface BulkWarehouseLocationResult {
  location: string;
  success: boolean;
  error?: string;
}

export function fetchWarehouseLocations(token: string) {
  return apiRequest<WarehouseLocation[]>('/warehouse-locations', { token });
}

export function createWarehouseLocation(token: string, location: string, description: string) {
  return apiRequest<WarehouseLocation>('/warehouse-locations', {
    method: 'POST',
    token,
    body: { location, description: description || undefined },
  });
}

export function updateWarehouseLocation(token: string, id: string, data: { location?: string; description?: string }) {
  return apiRequest<WarehouseLocation>(`/warehouse-locations/${id}`, { method: 'PATCH', token, body: data });
}

export function removeWarehouseLocation(token: string, id: string) {
  return apiRequest<{ success: true }>(`/warehouse-locations/${id}`, { method: 'DELETE', token });
}

/** Excel bulk-upload flow — see WarehouseLocationsPage. */
export function bulkUpsertWarehouseLocations(token: string, rows: BulkWarehouseLocationItem[]) {
  return apiRequest<BulkWarehouseLocationResult[]>('/warehouse-locations/bulk', {
    method: 'POST',
    token,
    body: { rows },
  });
}
