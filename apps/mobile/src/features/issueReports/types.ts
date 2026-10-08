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

/** Field sets match the requirements doc exactly — see the backend's issue-report.types.ts doc comment. */
export const CATEGORY_META: CategoryMeta[] = [
  {
    category: 'non_traceable_return_parcel',
    label: 'Non-traceable Return Parcel',
    photos: { label: 'Photo of part/parcel', max: 1 },
    trackingId: { label: 'Tracking ID' },
    comment: { label: 'Comment', hint: 'Any information about the parcel? ID of part? Seller name?' },
  },
  {
    category: 'non_fulfillment_return_parcel',
    label: 'Non-fulfillment Return Parcel',
    photos: { label: 'Photo of part/parcel', max: 1 },
    trackingId: { label: 'Tracking ID' },
    comment: { label: 'Comment', hint: 'Any information about the parcel? ID of part? Seller name?' },
  },
  {
    category: 'no_return_request_generated',
    label: 'No Return Request Generated',
    trackingId: { label: 'Tracking ID' },
    orderNumber: { label: 'Order Number' },
    comment: { label: 'Comment', hint: 'Can you tell what the return reason is?' },
  },
  {
    category: 'shipment_label_not_generatable',
    label: 'Shipment Label Not Generatable',
    photos: { label: 'Photo of error page', max: 1 },
    orderNumber: { label: 'Order Number' },
    errorNo: { label: 'Error No.' },
    comment: { label: 'Comment' },
  },
  {
    category: 'item_found_out_of_location',
    label: 'Item Found Out of Location',
    photos: { label: 'Photo of item', max: 1 },
    idNumber: { label: 'ID Number' },
    comment: { label: 'Comment', hint: 'Handed to whom?' },
  },
  {
    category: 'empty_crate',
    label: 'Empty Crate',
    photos: { label: 'Photo of crate', max: 1 },
    locationId: { label: 'Location ID' },
  },
  {
    category: 'part_broken_in_location',
    label: 'Part Broken in the Location',
    locationId: { label: 'Location ID' },
    photos: { label: 'Photos of the damaged part', max: 6 },
    comment: { label: 'Comment', hint: 'Part ID, order ID if any, seller name if known' },
  },
  {
    category: 'heavy_crate',
    label: 'Heavy Crate',
    photos: { label: 'Photo of crate', max: 1 },
    locationId: { label: 'Location ID' },
  },
  {
    category: 'other',
    label: 'Other',
    strongDividerAbove: true,
    comment: { label: 'What happened?' },
    photos: { label: 'Photo (optional)', max: 3, optional: true },
  },
];

export function metaFor(category: IssueReportCategory): CategoryMeta {
  return CATEGORY_META.find((m) => m.category === category)!;
}
