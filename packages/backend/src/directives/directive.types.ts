export type DirectiveType = 'photo_demand' | 'clear_stalled_task' | 'recount_inventory' | 'verify_location' | 'custom';
export const DIRECTIVE_TYPES: DirectiveType[] = [
  'photo_demand',
  'clear_stalled_task',
  'recount_inventory',
  'verify_location',
  'custom',
];

export type DirectiveStatus = 'pushed' | 'in_progress' | 'resolved';

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
