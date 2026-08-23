/**
 * Feature 5 (Order Preparation) from the requirements doc. Unlike the
 * other features, this isn't one item moving through a pipeline — it's
 * a labor calculator (how many pickers/packers for a volume of parts)
 * plus staggered per-staff task assignment reusing the same
 * assign→start→complete pattern as Put-Away.
 *
 * The doc gives throughput rates but no formula for staff count or
 * stagger delay — both below are documented, tunable assumptions, not
 * values from the doc itself.
 */
export const PICKER_PARTS_PER_HOUR = 25;
export const PACKER_PARTS_PER_HOUR = 20;

/** Matches Feature 1's attendance shift length — "the day" the doc asks pickers/packers to be sized for. */
export const SHIFT_HOURS = 7;

/**
 * How much of a packed-and-ready buffer (in minutes of packer capacity)
 * should exist before packing starts, so packers never go idle waiting
 * on pickers. Doc: "packing start time ... to prevent packer idle time."
 */
export const PACKER_BUFFER_MINUTES = 20;

export type OrderPrepTaskRole = 'picker' | 'packer';
export type OrderPrepTaskStatus = 'assigned' | 'in_progress' | 'completed';

export interface OrderPrepSession {
  id: string;
  totalParts: number;
  pickersNeeded: number;
  packersNeeded: number;
  /** Minutes after the first picker actually starts before packers may start. */
  packingDelayMinutes: number;
  /** Set when the first picker task for this session is started — packer gating is relative to this, not to session creation time. */
  pickingStartedAt: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface OrderPrepTask {
  id: string;
  sessionId: string;
  role: OrderPrepTaskRole;
  assignedToUserId: string;
  status: OrderPrepTaskStatus;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}
