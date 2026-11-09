import { apiRequest } from './client';

/** Mirrors packages/backend/src/reference-lists/reference-list.types.ts. */
export type ReferenceListCategory =
  | 'transporter_company'
  | 'packaging_type'
  | 'issue_type'
  | 'color_tag'
  | 'seller_name';

export const REFERENCE_LIST_LABELS: Record<ReferenceListCategory, string> = {
  transporter_company: 'Transporter Companies',
  packaging_type: 'Packaging Types',
  issue_type: 'Report Issue Types',
  color_tag: 'Color Tags',
  seller_name: 'Sellers',
};

export interface ReferenceListValue {
  id: string;
  category: ReferenceListCategory;
  value: string;
  createdAt: string;
}

export function fetchAllReferenceLists(token: string) {
  return apiRequest<Record<ReferenceListCategory, ReferenceListValue[]>>('/reference-lists', { token });
}

export function addReferenceListValue(token: string, category: ReferenceListCategory, value: string) {
  return apiRequest<ReferenceListValue>(`/reference-lists/${category}`, { method: 'POST', token, body: { value } });
}

export function removeReferenceListValue(token: string, category: ReferenceListCategory, id: string) {
  return apiRequest<{ success: true }>(`/reference-lists/${category}/${id}`, { method: 'DELETE', token });
}
