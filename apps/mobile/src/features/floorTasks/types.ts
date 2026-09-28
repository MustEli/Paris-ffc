/** Mirrors packages/backend/src/floor-tasks/floor-task.types.ts. */
export type FloorTaskCategory =
  | 'pick'
  | 'pack'
  | 'return_processing'
  | 'box_prep'
  | 'warehousing_inventory_check'
  | 'warehousing_location_adjustment'
  | 'backup_box'
  | 'backup_shredder'
  | 'backup_other';

export const FLOOR_TASK_MAX_PHOTOS = 8;

export interface FloorTaskLog {
  id: string;
  userId: string;
  category: FloorTaskCategory;
  startedAt: string;
  endedAt: string | null;
  count: number | null;
  countExtra: number | null;
  zone: string | null;
  comment: string | null;
  photoUrls: string[];
}

export interface CategoryMeta {
  category: FloorTaskCategory;
  label: string;
  countLabel?: string;
  countExtraLabel?: string;
  needsZone?: boolean;
  needsComment?: boolean;
  needsPhotos?: boolean;
}

/** Order and grouping matches the Staff View doc's Floor Tasks Module. */
export const CATEGORY_META: CategoryMeta[] = [
  { category: 'pick', label: 'Pick', countLabel: '# Picked', countExtraLabel: '# Not Found' },
  { category: 'pack', label: 'Pack', countLabel: '# Packed' },
  { category: 'return_processing', label: 'Return', countLabel: '# Non-Fulfillment', countExtraLabel: '# Fulfillment' },
  { category: 'box_prep', label: 'Box Prep', countLabel: '# Prepared' },
  {
    category: 'warehousing_inventory_check',
    label: 'Warehousing — Inventory Check',
    countLabel: '# Locations Checked',
    needsZone: true,
    needsComment: true,
    needsPhotos: true,
  },
  {
    category: 'warehousing_location_adjustment',
    label: 'Warehousing — Location Adjustment',
    countLabel: '# Locations Processed',
    needsZone: true,
    needsComment: true,
    needsPhotos: true,
  },
  { category: 'backup_box', label: 'Backup — Box', countLabel: '# Prepared Boxes' },
  { category: 'backup_shredder', label: 'Backup — Shredder', countLabel: '# Prepared Containers' },
  { category: 'backup_other', label: 'Backup — Other', needsComment: true },
];
