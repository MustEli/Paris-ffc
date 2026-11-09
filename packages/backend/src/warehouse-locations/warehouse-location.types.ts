export interface WarehouseLocation {
  id: string;
  location: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One row's outcome from WarehouseLocationsService.bulkUpsert() — a bad row never aborts the rest. */
export interface BulkWarehouseLocationResult {
  location: string;
  success: boolean;
  error?: string;
}
