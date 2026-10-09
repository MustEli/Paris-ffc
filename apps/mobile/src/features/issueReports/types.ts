/** Mirrors packages/backend/src/issue-reports/issue-report.types.ts. */
export type IssueReportCategory =
  | 'non_traceable_return_parcel'
  | 'non_fulfillment_return_parcel'
  | 'no_return_request_generated'
  | 'shipment_label_not_generatable'
  | 'item_found_out_of_location'
  | 'empty_crate'
  | 'part_broken_in_location'
  | 'heavy_crate'
  | 'other';

export interface IssueReport {
  id: string;
  userId: string;
  category: IssueReportCategory;
  photoUrls: string[];
  trackingId: string | null;
  orderNumber: string | null;
  errorNo: string | null;
  idNumber: string | null;
  locationId: string | null;
  comment: string | null;
  alertsAdmin: boolean;
  createdAt: string;
}

export interface CreateIssueReportInput {
  category: IssueReportCategory;
  photoUrls?: string[];
  trackingId?: string;
  orderNumber?: string;
  errorNo?: string;
  idNumber?: string;
  locationId?: string;
  comment?: string;
}

export interface CategoryMeta {
  category: IssueReportCategory;
  label: string;
  /** A visibly stronger divider above this row — only "Other" uses it, to set the catch-all apart from the 8 fixed categories. */
  strongDividerAbove?: boolean;
  photos?: { label: string; max: number; optional?: boolean };
  trackingId?: { label: string };
  orderNumber?: { label: string };
  errorNo?: { label: string };
  idNumber?: { label: string };
  locationId?: { label: string };
  comment?: { label: string; hint?: string };
}

/**
 * Field sets match the requirements doc exactly — see the backend's
 * issue-report.types.ts doc comment. All `label`/`hint` values here are
 * i18n keys (see core/i18n/translations/en.ts's `issueReports`
 * namespace), not display text — callers must wrap with t().
 */
export const CATEGORY_META: CategoryMeta[] = [
  {
    category: 'non_traceable_return_parcel',
    label: 'issueReports.category.non_traceable_return_parcel',
    photos: { label: 'issueReports.field.photoOfPartParcel', max: 1 },
    trackingId: { label: 'issueReports.field.trackingId' },
    comment: { label: 'issueReports.field.comment', hint: 'issueReports.field.commentHintReturnParcel' },
  },
  {
    category: 'non_fulfillment_return_parcel',
    label: 'issueReports.category.non_fulfillment_return_parcel',
    photos: { label: 'issueReports.field.photoOfPartParcel', max: 1 },
    trackingId: { label: 'issueReports.field.trackingId' },
    comment: { label: 'issueReports.field.comment', hint: 'issueReports.field.commentHintReturnParcel' },
  },
  {
    category: 'no_return_request_generated',
    label: 'issueReports.category.no_return_request_generated',
    trackingId: { label: 'issueReports.field.trackingId' },
    orderNumber: { label: 'issueReports.field.orderNumber' },
    comment: { label: 'issueReports.field.comment', hint: 'issueReports.field.commentHintNoReturnRequest' },
  },
  {
    category: 'shipment_label_not_generatable',
    label: 'issueReports.category.shipment_label_not_generatable',
    photos: { label: 'issueReports.field.photoOfErrorPage', max: 1 },
    orderNumber: { label: 'issueReports.field.orderNumber' },
    errorNo: { label: 'issueReports.field.errorNo' },
    comment: { label: 'issueReports.field.comment' },
  },
  {
    category: 'item_found_out_of_location',
    label: 'issueReports.category.item_found_out_of_location',
    photos: { label: 'issueReports.field.photoOfItem', max: 1 },
    idNumber: { label: 'issueReports.field.idNumber' },
    comment: { label: 'issueReports.field.comment', hint: 'issueReports.field.commentHintItemFound' },
  },
  {
    category: 'empty_crate',
    label: 'issueReports.category.empty_crate',
    photos: { label: 'issueReports.field.photoOfCrate', max: 1 },
    locationId: { label: 'issueReports.field.locationId' },
  },
  {
    category: 'part_broken_in_location',
    label: 'issueReports.category.part_broken_in_location',
    locationId: { label: 'issueReports.field.locationId' },
    photos: { label: 'issueReports.field.photosOfDamagedPart', max: 6 },
    comment: { label: 'issueReports.field.comment', hint: 'issueReports.field.commentHintPartBroken' },
  },
  {
    category: 'heavy_crate',
    label: 'issueReports.category.heavy_crate',
    photos: { label: 'issueReports.field.photoOfCrate', max: 1 },
    locationId: { label: 'issueReports.field.locationId' },
  },
  {
    category: 'other',
    label: 'issueReports.category.other',
    strongDividerAbove: true,
    comment: { label: 'issueReports.field.whatHappened' },
    photos: { label: 'issueReports.field.photoOptional', max: 3, optional: true },
  },
];

export function metaFor(category: IssueReportCategory): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}
