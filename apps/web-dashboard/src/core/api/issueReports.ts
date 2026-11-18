import { apiRequest } from './client';

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

export interface IssueReport {
  id: string;
  userId: string;
  userName: string;
  category: IssueReportCategory;
  photoUrls: string[];
  trackingId: string | null;
  orderNumber: string | null;
  errorNo: string | null;
  idNumber: string | null;
  locationId: string | null;
  comment: string | null;
  /** What the staff member was doing when they raised this — only set by the in-task quick-report shortcut. */
  contextLabel: string | null;
  alertsAdmin: boolean;
  createdAt: string;
  /** Admin's "confirm seen it" review step — both null until acknowledged. */
  seenAt: string | null;
  seenByUserId: string | null;
  seenByName: string | null;
}

export function fetchAllIssueReports(token: string) {
  return apiRequest<IssueReport[]>('/issue-reports', { token });
}

export function markIssueReportSeen(token: string, id: string) {
  return apiRequest<IssueReport>(`/issue-reports/${id}/seen`, { method: 'PATCH', token });
}

export function deleteIssueReport(token: string, id: string) {
  return apiRequest<void>(`/issue-reports/${id}`, { method: 'DELETE', token });
}
