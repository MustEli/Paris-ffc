/** Mirrors packages/backend/src/floor-tasks/floor-task.types.ts. */
export type FloorTaskCategory =
  | 'pick'
  | 'pack'
  | 'dispatch'
  | 'return_processing'
  | 'box_prep'
  | 'warehousing_inventory_check'
  | 'warehousing_location_adjustment'
  | 'backup_box'
  | 'backup_shredder'
  | 'backup_other';

export const FLOOR_TASK_CATEGORY_LABELS: Record<FloorTaskCategory, string> = {
  pick: 'Pick',
  pack: 'Pack',
  dispatch: 'Dispatch',
  return_processing: 'Return',
  box_prep: 'Box Prep',
  warehousing_inventory_check: 'Warehousing — Inventory Check',
  warehousing_location_adjustment: 'Warehousing — Location Adjustment',
  backup_box: 'Backup — Box',
  backup_shredder: 'Backup — Shredder',
  backup_other: 'Backup — Other',
};
