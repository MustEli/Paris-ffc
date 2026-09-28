import { apiRequest } from './client';

export type DirectiveType = 'photo_demand' | 'clear_stalled_task' | 'recount_inventory' | 'verify_location' | 'custom';
export type DirectiveStatus = 'pushed' | 'in_progress' | 'resolved';

export const DIRECTIVE_TYPE_LABELS: Record<DirectiveType, string> = {
  photo_demand: 'Photo Required',
  clear_stalled_task: 'Clear Stalled Task',
  recount_inventory: 'Re-count Inventory',
  verify_location: 'Verify Location',
  custom: 'Custom',
};

export const DIRECTIVE_TYPES: DirectiveType[] = [
  'photo_demand',
  'clear_stalled_task',
  'recount_inventory',
  'verify_location',
  'custom',
];

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

export interface CreateDirectiveInput {
  targetUserId?: string;
  type: DirectiveType;
  message: string;
}

export function fetchAllDirectives(token: string) {
  return apiRequest<Directive[]>('/directives', { token });
}

export function createDirective(token: string, input: CreateDirectiveInput) {
  return apiRequest<Directive>('/directives', { method: 'POST', token, body: input });
}
