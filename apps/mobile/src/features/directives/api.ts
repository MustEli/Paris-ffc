import { apiRequest } from '../../core/api/client';
import { type Directive } from './types';

export function fetchMyDirectives(token: string) {
  return apiRequest<Directive[]>('/directives/mine', { token });
}

export function acknowledgeDirective(token: string, id: string) {
  return apiRequest<Directive>(`/directives/${id}/acknowledge`, { method: 'POST', token });
}

export function resolveDirective(token: string, id: string, photoUrl?: string) {
  return apiRequest<Directive>(`/directives/${id}/resolve`, { method: 'POST', token, body: { photoUrl } });
}
