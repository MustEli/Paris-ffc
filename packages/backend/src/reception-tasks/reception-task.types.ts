/**
 * Times a staff member's trip into the Reception flow, from pressing
 * Start (before they've even picked a category) to either logging a
 * delivery (`completed`, linked to the Reception it created) or
 * explicitly abandoning it (`unfinished`). Same start/pause/resume
 * shape as FloorTaskLog (pausedAt + totalPausedMs) — see
 * floor-tasks.service.ts, which this mirrors closely.
 */
export interface ReceptionTask {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  totalPausedMs: number;
  outcome: 'completed' | 'unfinished' | null;
  receptionId: string | null;
}
