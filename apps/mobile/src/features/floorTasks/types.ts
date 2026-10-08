/**
 * Mirrors packages/backend/src/floor-tasks/floor-task.types.ts.
 * 'box_prep' stays in the type (historical rows may use it) but is
 * excluded from CATEGORY_META below — merged into 'backup_box' in the
 * Staff-view redesign (see the backend's doc comment).
 */
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
  pausedAt: string | null;
  totalPausedMs: number;
}

export interface CategoryMeta {
  category: FloorTaskCategory;
  label: string;
  countLabel?: string;
  countExtraLabel?: string;
  needsZone?: boolean;
  needsComment?: boolean;
  needsPhotos?: boolean;
  /** A visibly stronger divider below this row — see the Staff-view redesign's Floor Tasks clustering: [Pick,Pack] / [Return] / [Inventory,Location] / [Backup x3]. */
  strongDividerBelow?: boolean;
}

/**
 * Staff-view redesign's Floor Tasks clustering (box_prep excluded —
 * merged into backup_box, see FloorTaskCategory's doc comment above).
 * 'Putaway' and 'Open Pool Tasks' are NOT in this list — they're plain
 * navigation rows handled directly in FloorTasksMenuScreen, not real
 * FloorTaskCategory values.
 */
export const CATEGORY_META: CategoryMeta[] = [
  { category: 'pick', label: 'Pick', countLabel: '# Picked', countExtraLabel: '# Not Found' },
  { category: 'pack', label: 'Pack', countLabel: '# Packed', strongDividerBelow: true },
  { category: 'return_processing', label: 'Return Processing', countLabel: '# Non-Fulfillment', countExtraLabel: '# Fulfillment', strongDividerBelow: true },
  {
    category: 'warehousing_inventory_check',
    label: 'Inventory Check',
    countLabel: '# Locations Checked',
    needsZone: true,
    needsComment: true,
    needsPhotos: true,
  },
  {
    category: 'warehousing_location_adjustment',
    label: 'Location Adjustment',
    countLabel: '# Locations Processed',
    needsZone: true,
    needsComment: true,
    needsPhotos: true,
    strongDividerBelow: true,
  },
  { category: 'backup_box', label: 'Backup — Box', countLabel: '# Prepared Boxes' },
  { category: 'backup_shredder', label: 'Backup — Shredder', countLabel: '# Prepared Containers' },
  { category: 'backup_other', label: 'Backup — Other', needsComment: true },
];
