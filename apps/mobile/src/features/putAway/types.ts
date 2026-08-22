/** Mirrors packages/backend/src/put-away/put-away.types.ts. */
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

export const STATUS_LABELS: Record<PutAwayTaskStatus, string> = {
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  issue_reported: 'Issue reported',
};
