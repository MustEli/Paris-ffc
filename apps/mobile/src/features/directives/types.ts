/** Mirrors packages/backend/src/directives/directive.types.ts. */
export type DirectiveType = 'photo_demand' | 'clear_stalled_task' | 'recount_inventory' | 'verify_location' | 'custom';
export type DirectiveStatus = 'pushed' | 'in_progress' | 'resolved';

export const DIRECTIVE_TYPE_LABELS: Record<DirectiveType, string> = {
  photo_demand: 'Photo Required',
  clear_stalled_task: 'Clear Stalled Task',
  recount_inventory: 'Re-count Inventory',
  verify_location: 'Verify Location',
  custom: 'Admin Directive',
};

export interface Directive {
  id: string;
  targetUserId: string | null;
  issuerUserId: string;
  type: DirectiveType;
  message: string;
  status: DirectiveStatus;
  receivedByUserId: string | null;
  photoUrl: string | null;
  pushedAt: string;
  receivedAt: string | null;
  resolvedAt: string | null;
}
