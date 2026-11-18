import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { createIssueReport, fetchMyIssueReports } from '../api';
import { type CreateIssueReportInput } from '../types';

const MY_REPORTS_KEY = ['issue-reports', 'mine'];

export function useCreateIssueReport() {
  const token = useAuthStore((state) => state.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateIssueReportInput) => createIssueReport(token!, input),
    // Covers every taskRef-scoped list below too — react-query matches
    // this as a prefix of ['issue-reports', 'mine', taskRef].
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_REPORTS_KEY }),
  });
}

/** Powers each task screen's "issues you already raised for this one" list — see RaisedIssuesList. */
export function useMyIssueReportsForTask(taskRef: string | null) {
  const token = useAuthStore((state) => state.token);
  return useQuery({
    queryKey: [...MY_REPORTS_KEY, taskRef],
    queryFn: () => fetchMyIssueReports(token!, taskRef!),
    enabled: !!token && !!taskRef,
  });
}
