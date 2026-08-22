/**
 * Feature 4 (Seller Stock Put-Away & Location Assignment) from the
 * requirements doc. This is the proper per-staff task-assignment layer
 * the doc describes — Admin assigns a *specific* pallet to a *specific*
 * staff member (not just a shared location note) with start/complete
 * timestamps and issue reporting. It supersedes the simpler
 * instructions/put-away endpoints that used to live directly on
 * SellerStockController — those are gone; PutAwayService now owns that
 * transition internally via SellerStockService.
 */
export type PutAwayTaskStatus = 'assigned' | 'in_progress' | 'completed' | 'issue_reported';

export interface PutAwayTask {
  id: string;
  palletId: string;
  assignedToUserId: string;
  assignedByUserId: string;
  location: string;
  status: PutAwayTaskStatus;
  assignedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  issueDescription: string | null;
}
