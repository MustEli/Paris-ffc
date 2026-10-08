/**
 * Staff-view redesign's "Issue Reporting" main-menu entry — one-tap
 * floor-blocker capture. Each category has its own fixed set of
 * required fields (enforced in issue-reports.service.ts, not here —
 * same "flattened nullable columns" pattern as Reception and
 * FloorTaskLog):
 *
 *   non_traceable_return_parcel    -> photoUrls, trackingId, comment
 *   non_fulfillment_return_parcel  -> photoUrls, trackingId, comment
 *   no_return_request_generated    -> trackingId, orderNumber, comment
 *   shipment_label_not_generatable -> photoUrls, orderNumber, errorNo, comment
 *   item_found_out_of_location     -> photoUrls, idNumber, comment
 *   empty_crate                    -> photoUrls, locationId
 *   part_broken_in_location        -> locationId, photoUrls, comment
 *   heavy_crate                    -> photoUrls, locationId
 *   other                          -> comment, photoUrls optional
 *
 * Deliberately a fixed, hardcoded list rather than an Admin-editable
 * one — the doc asks for Admin to manage this "as we move forward,"
 * but each category here has its own bespoke field set and
 * validation, not just a label; a true Admin-authored dynamic-field
 * version is a form-builder-sized feature on its own, out of scope for
 * this pass.
 */
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

export const ISSUE_REPORT_CATEGORIES: IssueReportCategory[] = [
  'non_traceable_return_parcel',
  'non_fulfillment_return_parcel',
  'no_return_request_generated',
  'shipment_label_not_generatable',
  'item_found_out_of_location',
  'empty_crate',
  'part_broken_in_location',
  'heavy_crate',
  'other',
];

/**
 * Which categories push a real-time alert to Admin on submit vs. just
 * get recorded silently — "Empty Crate" and "Heavy Crate" are
 * placeholders reserved for future integration work (doc's own
 * wording), and "Item Found Out of Location" is recording-only by
 * design. "Other" alerts, since anything that didn't fit the other 8
 * categories is exactly the kind of thing Admin should see right away.
 */
export const ALERTING_CATEGORIES: IssueReportCategory[] = [
  'non_traceable_return_parcel',
  'non_fulfillment_return_parcel',
  'no_return_request_generated',
  'shipment_label_not_generatable',
  'part_broken_in_location',
  'other',
];

/** "Mix of capital letters and numbers, no space or other character" per the doc. */
export const TRACKING_ID_PATTERN = /^[A-Z0-9]+$/;
/** "Only numbers, no character or letter" per the doc — used for both Order Number and ID Number. */
export const NUMERIC_ONLY_PATTERN = /^[0-9]+$/;
/** "Numbers, letters, no space" per the doc — used for Location ID. */
export const LOCATION_ID_PATTERN = /^[A-Za-z0-9]+$/;

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

/** Admin's review list — who reported what, when. */
export interface IssueReportWithReporter extends IssueReport {
  userName: string;
}
