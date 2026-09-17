/** Mirrors packages/backend/src/tasks/task-priority.ts. Manual for now — see that file's doc comment. */
export type TaskPriority = 'normal' | 'high' | 'urgent';

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  normal: '#64748b',
  high: '#d97706',
  urgent: '#dc2626',
};

const PRIORITY_RANK: Record<TaskPriority, number> = { normal: 0, high: 1, urgent: 2 };

export function priorityRank(priority: TaskPriority): number {
  return PRIORITY_RANK[priority];
}
