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

export const FLOOR_TASK_CATEGORIES: FloorTaskCategory[] = [
  'pick',
  'pack',
  'dispatch',
  'return_processing',
  'box_prep',
  'warehousing_inventory_check',
  'warehousing_location_adjustment',
  'backup_box',
  'backup_shredder',
  'backup_other',
];
