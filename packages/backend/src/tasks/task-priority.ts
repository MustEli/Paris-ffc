/**
 * Shared by PutAwayTask and OrderPrepTask — set by Admin at assignment
 * time via the Task Board (see tasks.service.ts). Manual for now; the
 * user's own note is that this will later be assigned by an AI ruleset
 * instead, so keep this as plain data, not business logic.
 */
export type TaskPriority = 'normal' | 'high' | 'urgent';

export const TASK_PRIORITIES: TaskPriority[] = ['normal', 'high', 'urgent'];
