import { apiRequest } from '../../core/api/client';
import { type CreateIssueReportInput, type IssueReport } from './types';

export function createIssueReport(token: string, input: CreateIssueReportInput) {
  return apiRequest<IssueReport>('/issue-reports', { method: 'POST', token, body: input });
}

/** The current staff member's own reports, optionally scoped to one specific task instance. */
export function fetchMyIssueReports(token: string, taskRef?: string) {
  const query = taskRef ? `?taskRef=${encodeURIComponent(taskRef)}` : '';
  return apiRequest<IssueReport[]>(`/issue-reports/mine${query}`, { token });
}
