/**
 * Staff View doc's self-serve floor tasks — see schema.prisma's
 * FloorTaskLog doc comment for why this is one generic model. `count`/
 * `countExtra` are given category-specific meaning here, not in the
 * schema:
 *   pick                         -> count: picked,            countExtra: not found
 *   pack                         -> count: packed
 *   dispatch                     -> scannedBarcode only (no count/zone/comment/photos)
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

/**
 * Staff-view redesign: 'box_prep' and 'backup_box' were the same
 * real-world task, built twice across two revisions of the
 * requirements doc. Resolved by merging into 'backup_box' going
 * forward — 'box_prep' stays in FloorTaskCategory/FLOOR_TASK_CATEGORIES
 * (never remove a value real historical data may use) but is excluded
 * here so the new UI never offers it, and FloorTasksService.start()
 * rejects it outright so no new rows are ever created with it.
 */
export const SELECTABLE_FLOOR_TASK_CATEGORIES: FloorTaskCategory[] = FLOOR_TASK_CATEGORIES.filter(
  (c) => c !== 'box_prep',
);

/** Up to 8 photos — Staff View doc's Warehousing Tasks spec. */
export const FLOOR_TASK_MAX_PHOTOS = 8;

/** Cancelling this soon after Start leaves no trace at all (row deleted) — long enough past this and it's treated as real, if abandoned, work (row kept, marked cancelledAt). */
export const FLOOR_TASK_CANCEL_NO_TRACE_WINDOW_MS = 2 * 60_000;

/** A staff member may have at most this many *paused* floor tasks parked at once (not counting whichever one is currently active) — business owner's call, to stop unfinished work from piling up unbounded. */
export const FLOOR_TASK_MAX_PAUSED = 2;

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
  /** 'dispatch' category only — see this file's doc comment above. */
  scannedBarcode: string | null;
  /** Set while paused, null otherwise — see FloorTasksService.pause/resume. */
  pausedAt: string | null;
  /** Cumulative paused time across every pause/resume cycle, in ms. */
  totalPausedMs: number;
  /** Set only for a cancel 2+ minutes after start — see FloorTasksService.cancel(). A cancel under 2 minutes deletes the row instead, so this field never shows that case. */
  cancelledAt: string | null;
}

/** Admin's live "who's on what floor task right now" view. */
export interface ActiveFloorTask extends FloorTaskLog {
  userName: string;
}
