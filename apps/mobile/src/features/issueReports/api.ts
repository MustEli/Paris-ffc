import { apiRequest } from '../../core/api/client';
import { type CreateIssueReportInput, type IssueReport } from './types';

export function createIssueReport(token: string, input: CreateIssueReportInput) {
  return apiRequest<IssueReport>('/issue-reports', { method: 'POST', token, body: input });
}
