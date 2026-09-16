/**
 * See schema.prisma's ReferenceListCategory enum doc comment — adding a
 * new admin-managed dropdown category means adding it here (and there),
 * nothing else. Everything in this module already works generically
 * for any category in this list.
 */
export type ReferenceListCategory = 'transporter_company' | 'packaging_type';

export const REFERENCE_LIST_CATEGORIES: ReferenceListCategory[] = ['transporter_company', 'packaging_type'];

export function isReferenceListCategory(value: string): value is ReferenceListCategory {
  return (REFERENCE_LIST_CATEGORIES as string[]).includes(value);
}

export interface ReferenceListValue {
  id: string;
  category: ReferenceListCategory;
  value: string;
  createdAt: string;
}
