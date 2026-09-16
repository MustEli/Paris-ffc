import { apiRequest } from './client';

/** Mirrors packages/backend/src/reference-lists/reference-list.types.ts. */
export type ReferenceListCategory = 'transporter_company' | 'packaging_type';

export interface ReferenceListValue {
  id: string;
  category: ReferenceListCategory;
  value: string;
  createdAt: string;
}

/** Any authenticated role can read — used to populate dropdowns (e.g. Reception's category-specific fields). */
export function fetchReferenceList(token: string, category: ReferenceListCategory) {
  return apiRequest<ReferenceListValue[]>(`/reference-lists/${category}`, { token });
}
