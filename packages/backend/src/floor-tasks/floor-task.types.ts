/**
 * Staff View doc's self-serve floor tasks — see schema.prisma's
 * FloorTaskLog doc comment for why this is one generic model. `count`/
 * `countExtra` are given category-specific meaning here, not in the
 * schema:
 *   pick                         -> count: picked,            countExtra: not found
 *   pack                         -> count: packed
 *   return_processing            -> count: non-fulfillment,    countExtra: fulfillment
 *   box_prep                     -> count: prepared
 *   warehousing_inventory_check  -> count: locations checked,  zone + comment
 *   warehousing_location_adjustment -> count: locations processed, zone + comment
 *   backup_box                   -> count: boxes prepared
 *   backup_shredder              -> count: containers prepared
 *   backup_other                 -> comment only (no count)
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

export const FLOOR_TASK_CATEGORIES: FloorTaskCategory[] = [
  'pick',
  'pack',
  'return_processing',
  'box_prep',
  'warehousing_inventory_check',
  'warehousing_location_adjustment',
  'backup_box',
  'backup_shredder',
  'backup_other',
];

/** Up to 8 photos — Staff View doc's Warehousing Tasks spec. */
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

/** Admin's live "who's on what floor task right now" view. */
export interface ActiveFloorTask extends FloorTaskLog {
  userName: string;
}
