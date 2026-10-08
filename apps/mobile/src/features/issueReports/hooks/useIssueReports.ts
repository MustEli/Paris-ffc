import { useMutation } from '@tanstack/react-query';

import { useAuthStore } from '../../../core/auth/authStore';
import { createIssueReport } from '../api';
import { type CreateIssueReportInput } from '../types';

export function useCreateIssueReport() {
  const token = useAuthStore((state) => state.token);
  return useMutation({
    mutationFn: (input: CreateIssueReportInput) => createIssueReport(token!, input),
  });
}
